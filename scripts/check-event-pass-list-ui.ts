import assert from 'node:assert/strict';

import type { Pass } from '../src/lib/database.types';
import {
  DEFAULT_EVENT_PASS_SORT,
  filterEventPasses,
  getEventPassSortOptions,
  isEventPassSortKeyAllowed,
  passMatchesSearch,
  prepareEventPassList,
  sortEventPasses,
  toggleEventPassSort,
} from '../src/lib/event-pass-list-ui';

function makePass(overrides: Partial<Pass> = {}): Pass {
  return {
    id: 'pass-1',
    event_id: 'event-1',
    guest_name: 'Alex Rivera',
    guest_email: 'alex@example.com',
    guest_phone: '+15551234567',
    pass_type: 'General Admission',
    secure_token: 'a'.repeat(64),
    status: 'active',
    checked_in_at: null,
    checked_in_by: null,
    created_at: '2026-06-01T18:00:00.000Z',
    updated_at: '2026-06-01T18:00:00.000Z',
    ...overrides,
  };
}

const passes: Pass[] = [
  makePass(),
  makePass({
    id: 'pass-2',
    guest_name: 'Blake Chen',
    guest_email: 'blake@venue.com',
    guest_phone: null,
    pass_type: 'VIP',
    status: 'checked_in',
    checked_in_at: '2026-06-01T20:00:00.000Z',
    created_at: '2026-06-01T17:00:00.000Z',
  }),
];

assert.equal(passMatchesSearch(passes[0], 'alex'), true);
assert.equal(passMatchesSearch(passes[0], 'alex@example.com'), true);
assert.equal(passMatchesSearch(passes[0], '555123'), true);
assert.equal(passMatchesSearch(passes[0], 'general'), true);
assert.equal(passMatchesSearch(passes[0], 'active'), true);
assert.equal(passMatchesSearch(passes[0], 'missing'), false);

assert.equal(filterEventPasses(passes, 'blake').length, 1);
assert.equal(filterEventPasses(passes, 'checked').length, 1);

const byName = sortEventPasses(passes, { key: 'name', direction: 'asc' });
assert.equal(byName[0].guest_name, 'Alex Rivera');

const issuedSortOptions = getEventPassSortOptions('issued').map((option) => option.key);
assert.deepEqual(issuedSortOptions, ['name', 'email', 'phone']);
assert.equal(isEventPassSortKeyAllowed('issued', 'status' as never), false);

const checkedInSortOptions = getEventPassSortOptions('checked_in').map((option) => option.key);
assert.deepEqual(checkedInSortOptions, ['name', 'email', 'phone', 'checked_in']);

const toggled = toggleEventPassSort({ key: 'name', direction: 'asc' }, 'name');
assert.equal(toggled.direction, 'desc');

const prepared = prepareEventPassList(passes, 'alex', DEFAULT_EVENT_PASS_SORT);
assert.equal(prepared.length, 1);

console.log('check-event-pass-list-ui: all checks passed');
