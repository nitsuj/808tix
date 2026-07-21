#!/usr/bin/env npx tsx
/**
 * Release proof harness for 808Tickets P0 launch readiness.
 *
 * Usage:
 *   npm run release:proof -- --prelaunch   # hosted QA with Stripe test keys allowed
 *   npm run release:proof -- --live        # strict live Stripe expectations
 *
 * Runs readiness gates in order and stops on first failure.
 * Does NOT run Stripe checkout, hosted checkout, deploys, or secret mutations.
 *
 * After PASS, manually run hosted checkout smoke on https://808tickets.com.
 * See docs/P0_ACCEPTANCE.md.
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();

type ProofMode = 'prelaunch' | 'live';

type Step = {
  label: string;
  command: string;
  args: string[];
  remediation: string;
  /** Env overlay for this step only (does not mutate parent process.env permanently). */
  envOverlay?: Record<string, string>;
};

function parseMode(argv: string[]): ProofMode | null {
  const hasPrelaunch = argv.includes('--prelaunch');
  const hasLive = argv.includes('--live');

  if (hasPrelaunch && hasLive) {
    console.error('Choose only one mode: --prelaunch or --live');
    process.exit(1);
  }

  if (hasPrelaunch) {
    return 'prelaunch';
  }

  if (hasLive) {
    return 'live';
  }

  return null;
}

function printModeHelp(): never {
  console.log('808Tickets release proof');
  console.log('Source of truth: docs/P0_ACCEPTANCE.md');
  console.log('');
  console.log('Choose an explicit mode:');
  console.log('');
  console.log('  npm run release:proof -- --prelaunch');
  console.log('    Hosted 808tickets.com readiness with Stripe TEST keys allowed.');
  console.log('    Sets CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION=true');
  console.log('    Sets AUTH_SMTP_OPERATOR_CONFIRMED=true');
  console.log('    Still fails if EXPO_PUBLIC_SUPABASE_URL or PUBLIC_SITE_URL is localhost.');
  console.log('');
  console.log('  npm run release:proof -- --live');
  console.log('    Strict production proof. Expects sk_live_* (unless explicitly overridden).');
  console.log('    No test Stripe override by default.');
  console.log('');
  console.log('Neither mode runs hosted checkout or Stripe smoke automatically.');
  console.log('After PASS, manually buy on https://808tickets.com.');
  process.exit(1);
}

function parseStatusEnv(stdout: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of stdout.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"/);
    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

async function loadLocalQaEnvOverlay(): Promise<Record<string, string>> {
  try {
    const { stdout } = await execFileAsync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
    const statusEnv = parseStatusEnv(stdout);
    const apiUrl = statusEnv.API_URL?.trim();
    const anonKey = statusEnv.ANON_KEY?.trim();

    if (!apiUrl || !anonKey) {
      throw new Error('API_URL or ANON_KEY missing from supabase status');
    }

    return {
      EXPO_PUBLIC_SUPABASE_URL: apiUrl,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    };
  } catch {
    console.error('\nLocal Supabase is required for qa:seed / qa:web / smoke:checkin.');
    console.error('Next action: run `supabase start`, then retry release:proof.');
    process.exit(1);
  }
}

function buildSteps(mode: ProofMode, localQaEnv: Record<string, string>): Step[] {
  const envLabel =
    mode === 'prelaunch'
      ? 'check:env (production, prelaunch / Stripe test allowed)'
      : 'check:env (production, live Stripe expected)';

  return [
    {
      label: envLabel,
      command: 'npm',
      args: ['run', 'check:env', '--', '--mode', 'production'],
      remediation:
        'Your local env is not configured for hosted proof. Use the hosted env file or pass required EXPO_PUBLIC_SUPABASE_URL/PUBLIC_SITE_URL values. This does not mean hosted Supabase is broken.\n' +
        'Also review docs/DOMAIN_CUTOVER.md and supabase/functions/.env vs hosted secrets.\n' +
        (mode === 'prelaunch'
          ? 'Prelaunch allows sk_test_* via CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION=true.'
          : 'Live mode expects sk_live_* unless CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION=true is set intentionally.'),
    },
    {
      label: 'check:hosted',
      command: 'npm',
      args: ['run', 'check:hosted'],
      remediation:
        'Inspect the check:hosted table for the specific failing row.\n' +
        'If failure is "remote RPC query parse": Hosted checker could not parse the remote RPC query output. Fix the checker/parser or run the direct pg_proc query. Do not assume hosted schema drift or run supabase db push.\n' +
        'If migrations are pending: supabase db push\n' +
        'If a function is missing: supabase functions deploy <name>\n' +
        'If a secret name is missing: supabase secrets set <name>=...',
    },
    {
      label: 'check:all',
      command: 'npm',
      args: ['run', 'check:all'],
      remediation: 'Inspect the failing static/UI contract check output and fix within that check’s scope.',
    },
    {
      label: 'qa:seed (local Supabase)',
      command: 'npm',
      args: ['run', 'qa:seed'],
      envOverlay: localQaEnv,
      remediation:
        'Start local Supabase (`supabase start`). release:proof injects local EXPO_PUBLIC_SUPABASE_* for this step automatically.',
    },
    {
      label: 'qa:web (local Supabase)',
      command: 'npm',
      args: ['run', 'qa:web'],
      envOverlay: localQaEnv,
      remediation:
        'Ensure local Expo web + Playwright Chromium. Install once: npx playwright install chromium.',
    },
    {
      label: 'smoke:checkin (local Supabase)',
      command: 'npm',
      args: ['run', 'smoke:checkin'],
      envOverlay: localQaEnv,
      remediation:
        'Reseed then retry: npm run qa:seed && npm run smoke:checkin. Requires local Supabase + qa/fixtures.json.',
    },
  ];
}

function runStep(step: Step, baseEnv: NodeJS.ProcessEnv): Promise<{ exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      cwd: ROOT,
      env: {
        ...baseEnv,
        ...(step.envOverlay ?? {}),
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        resolve({ exitCode: 1 });
        return;
      }

      resolve({ exitCode: code ?? 1 });
    });
  });
}

function applyModeEnv(mode: ProofMode): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (mode === 'prelaunch') {
    env.CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION = 'true';
    env.AUTH_SMTP_OPERATOR_CONFIRMED = 'true';
  }

  // live: do not set test Stripe override
  return env;
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));

  if (!mode) {
    printModeHelp();
  }

  const baseEnv = applyModeEnv(mode);
  const localQaEnv = await loadLocalQaEnvOverlay();
  const steps = buildSteps(mode, localQaEnv);

  console.log('808Tickets release proof');
  console.log(`Mode: ${mode}`);
  console.log('Source of truth: docs/P0_ACCEPTANCE.md');
  console.log('');

  if (mode === 'prelaunch') {
    console.log('Prelaunch overlays:');
    console.log('  CHECK_ENV_ALLOW_TEST_STRIPE_IN_PRODUCTION=true');
    console.log('  AUTH_SMTP_OPERATOR_CONFIRMED=true');
    console.log('Hosted check:env still requires non-localhost EXPO_PUBLIC_SUPABASE_URL + PUBLIC_SITE_URL.');
  } else {
    console.log('Live mode: expects sk_live_* unless you explicitly override.');
  }

  console.log('');
  console.log('Local QA steps (seed/web/checkin) inject local Supabase from `supabase status`.');
  console.log('This harness does NOT run Stripe checkout or hosted checkout.');
  console.log('After PASS, manually buy on https://808tickets.com.');
  console.log('');

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const line = '='.repeat(72);
    console.log(`\n${line}`);
    console.log(`[${index + 1}/${steps.length}] ${step.label}`);
    console.log(`$ ${step.command} ${step.args.join(' ')}`);
    console.log(line);

    const { exitCode } = await runStep(step, baseEnv);

    if (exitCode !== 0) {
      console.error(`\nFAIL: release proof stopped at step ${index + 1}/${steps.length}`);
      console.error(`Failing command: ${step.command} ${step.args.join(' ')}`);
      console.error(`Exit code: ${exitCode}`);
      console.error(`Next likely remediation:\n${step.remediation}`);

      if (index === 0) {
        console.error('');
        console.error(
          'Your local env is not configured for hosted proof. Use the hosted env file or pass required EXPO_PUBLIC_SUPABASE_URL/PUBLIC_SITE_URL values. This does not mean hosted Supabase is broken.',
        );
      }

      console.error('\nDo not claim launch readiness. See docs/P0_ACCEPTANCE.md');
      process.exit(exitCode);
    }
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`PASS: release proof (${mode}) commands succeeded.`);
  console.log('='.repeat(72));
  console.log('');
  console.log('Still required before launch claim (manual / hosted):');
  console.log('1. Hosted Stripe Checkout smoke on https://808tickets.com');
  if (mode === 'prelaunch') {
    console.log('   (prelaunch: use Stripe TEST card on a public event)');
  }
  console.log('2. Order confirmation email inbox proof');
  console.log('3. Auth confirm + password reset inbox proof (Resend SMTP)');
  console.log('4. Apple Wallet add on a production ticket');
  console.log('5. Live door scan + duplicate rejection');
  console.log('');
  console.log('Static PASS + local smoke alone is not hosted launch acceptance.');
}

main().catch((error) => {
  console.error('\nFAIL: release-proof runner error:', error);
  process.exit(1);
});
