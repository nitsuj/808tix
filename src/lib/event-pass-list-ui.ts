import type { Pass } from '@/lib/database.types';
import { formatPassStatusLabel } from '@/lib/pass-display';

export type EventPassSortKey = 'name' | 'email' | 'phone' | 'status' | 'issued' | 'checked_in';

export type EventPassSort = {
  key: EventPassSortKey;
  direction: 'asc' | 'desc';
};

export const DEFAULT_EVENT_PASS_SORT: EventPassSort = {
  key: 'name',
  direction: 'asc',
};

export const EVENT_PASS_SORT_OPTIONS: { key: EventPassSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status' },
  { key: 'issued', label: 'Issued' },
  { key: 'checked_in', label: 'Checked in' },
];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function passMatchesSearch(pass: Pass, rawQuery: string): boolean {
  const query = normalizeSearchText(rawQuery);

  if (!query) {
    return true;
  }

  const haystack = [
    pass.guest_name,
    pass.guest_email ?? '',
    pass.guest_phone ?? '',
    pass.pass_type,
    formatPassStatusLabel(pass.status),
    pass.status,
  ]
    .join(' ')
    .toLowerCase();

  if (haystack.includes(query)) {
    return true;
  }

  const queryDigits = digitsOnly(rawQuery);
  const phoneDigits = digitsOnly(pass.guest_phone ?? '');

  if (queryDigits.length >= 3 && phoneDigits.includes(queryDigits)) {
    return true;
  }

  return false;
}

export function filterEventPasses(passes: Pass[], rawQuery: string): Pass[] {
  const query = rawQuery.trim();

  if (!query) {
    return passes;
  }

  return passes.filter((pass) => passMatchesSearch(pass, query));
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareNullableStrings(a: string | null | undefined, b: string | null | undefined): number {
  const left = a?.trim() ?? '';
  const right = b?.trim() ?? '';

  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return compareStrings(left, right);
}

function compareTimestamps(a: string | null | undefined, b: string | null | undefined): number {
  const left = a ? Date.parse(a) : Number.NaN;
  const right = b ? Date.parse(b) : Number.NaN;

  if (Number.isNaN(left) && Number.isNaN(right)) {
    return 0;
  }

  if (Number.isNaN(left)) {
    return 1;
  }

  if (Number.isNaN(right)) {
    return -1;
  }

  return left - right;
}

function comparePasses(a: Pass, b: Pass, sort: EventPassSort): number {
  let result = 0;

  switch (sort.key) {
    case 'name':
      result = compareStrings(a.guest_name, b.guest_name);
      break;
    case 'email':
      result = compareNullableStrings(a.guest_email, b.guest_email);
      break;
    case 'phone':
      result = compareNullableStrings(a.guest_phone, b.guest_phone);
      break;
    case 'status':
      result = compareStrings(formatPassStatusLabel(a.status), formatPassStatusLabel(b.status));
      break;
    case 'issued':
      result = compareTimestamps(a.created_at, b.created_at);
      break;
    case 'checked_in':
      result = compareTimestamps(a.checked_in_at, b.checked_in_at);
      break;
    default:
      result = 0;
  }

  return sort.direction === 'asc' ? result : -result;
}

export function sortEventPasses(passes: Pass[], sort: EventPassSort): Pass[] {
  return [...passes].sort((a, b) => comparePasses(a, b, sort));
}

export function toggleEventPassSort(current: EventPassSort, key: EventPassSortKey): EventPassSort {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    };
  }

  return { key, direction: 'asc' };
}

export function prepareEventPassList(passes: Pass[], rawQuery: string, sort: EventPassSort): Pass[] {
  return sortEventPasses(filterEventPasses(passes, rawQuery), sort);
}
