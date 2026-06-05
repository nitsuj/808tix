#!/usr/bin/env npx tsx
/**
 * Server-side published-event guards for pass issuance and validate_pass.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATION_PATH = join(
  ROOT,
  'supabase/migrations/20260602143000_enforce_published_event_pass_ops.sql',
);
const VERIFICATION_PATH = join(ROOT, 'supabase/verification_published_event_guards.sql');

const migration = readFileSync(MIGRATION_PATH, 'utf8');
const verification = readFileSync(VERIFICATION_PATH, 'utf8');
const issuePassSource = readFileSync(join(ROOT, 'src/lib/issue-pass.ts'), 'utf8');

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ ${message}`);
    failures += 1;
    return;
  }
  console.log(`✓ ${message}`);
}

assert(
  migration.includes('prevent_pass_insert_unpublished_event'),
  'migration adds pass insert guard function',
);
assert(
  migration.includes('passes_prevent_unpublished_event_insert'),
  'migration adds pass insert guard trigger',
);
assert(
  migration.includes("Cannot issue passes for an unpublished event."),
  'pass insert guard uses app-facing error message',
);
assert(
  migration.includes("v_status is distinct from 'published'"),
  'pass insert guard requires published status',
);
assert(
  migration.includes('create or replace function public.validate_pass'),
  'migration updates validate_pass RPC',
);
assert(
  migration.includes("if v_event_status is distinct from 'published' then"),
  'validate_pass rejects unpublished events before check-in',
);
assert(
  migration.match(/if v_event_status is distinct from 'published' then[\s\S]*return jsonb_build_object\('result', 'invalid'\)/) !==
    null,
  'validate_pass returns invalid for unpublished events',
);
assert(
  migration.includes("values (v_pass.id, p_event_id, v_scanned_by, 'voided')"),
  'validate_pass preserves voided audit result',
);
assert(
  migration.includes("v_result := 'valid'"),
  'validate_pass preserves valid check-in path',
);
assert(
  migration.includes("'already_used'"),
  'validate_pass preserves already_used path',
);

assert(
  verification.includes('Cannot issue passes for an unpublished event.'),
  'verification script asserts draft pass insert is blocked',
);
assert(
  verification.includes("'guard-live-show', 'Live Show', 'published'"),
  'verification script asserts published pass insert succeeds',
);
assert(
  verification.includes('validate_pass on draft event must not insert checkins'),
  'verification script asserts no checkins for draft validate_pass',
);
assert(
  verification.includes("v_result ->> 'result' <> 'valid'"),
  'verification script asserts published validate_pass still works',
);

assert(
  issuePassSource.includes('mapInsertError'),
  'issuePass surfaces insert errors from database guard',
);

if (failures > 0) {
  console.error(`\ncheck-event-status-backend: ${failures} failure(s)`);
  process.exit(1);
}

console.log('\ncheck-event-status-backend: all checks passed');
