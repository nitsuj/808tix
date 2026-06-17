#!/usr/bin/env npx tsx
/**
 * Run the standard 808Tix validation suite in order.
 *
 * Usage:
 *   npm run check:all
 *   npm run check:all -- --fast
 *   npm run check:all -- --payments
 */
import { spawn } from 'node:child_process';

const FULL_SUITE = [
  'check:payments-schema',
  'check:payments-lifecycle',
  'check:payments-stripe-functions',
  'check:public-purchase-options',
  'check:purchase-ui',
  'check:preflight',
  'lint',
] as const;

const FAST_SUITE = ['check:preflight', 'lint'] as const;

const PAYMENTS_SUITE = [
  'check:payments-schema',
  'check:payments-lifecycle',
  'check:payments-stripe-functions',
  'check:public-purchase-options',
  'check:purchase-ui',
] as const;

type SuiteName = 'full' | 'fast' | 'payments';

function resolveSuite(argv: string[]): { name: SuiteName; commands: readonly string[] } {
  if (argv.includes('--fast')) {
    return { name: 'fast', commands: FAST_SUITE };
  }

  if (argv.includes('--payments')) {
    return { name: 'payments', commands: PAYMENTS_SUITE };
  }

  return { name: 'full', commands: FULL_SUITE };
}

function printHeader(index: number, total: number, command: string): void {
  const line = '='.repeat(72);
  console.log(`\n${line}`);
  console.log(`[${index}/${total}] npm run ${command}`);
  console.log(line);
}

function runNpmScript(scriptName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', scriptName], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  const { name, commands } = resolveSuite(process.argv.slice(2));
  const total = commands.length;

  console.log(`808Tix validation suite (${name}) — ${total} command(s)\n`);

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    printHeader(index + 1, total, command);

    const exitCode = await runNpmScript(command);

    if (exitCode !== 0) {
      console.error(`\n${'='.repeat(72)}`);
      console.error(`FAIL: npm run ${command} exited with code ${exitCode}`);
      console.error('='.repeat(72));
      process.exit(exitCode);
    }
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`PASS: all ${total} validation command(s) succeeded (${name} suite).`);
  console.log('='.repeat(72));
  console.log(
    'Validation complete. Manual Stripe smoke remains separate: npm run smoke:payments:local',
  );
}

main().catch((error) => {
  console.error('\nFAIL: check:all runner error:', error);
  process.exit(1);
});
