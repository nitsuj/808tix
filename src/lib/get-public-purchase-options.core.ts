import type {
  GetPublicEventPurchaseOptionsResult,
  PublicEventPurchaseTicketType,
} from '@/lib/database.types';

export type PurchaseUnavailableReason =
  | 'invalid_event_id'
  | 'invalid_ticket_type_id'
  | 'rpc_null'
  | 'rpc_error'
  | 'no_ticket_types'
  | 'ticket_type_not_found'
  | 'sold_out';

export function normalizeRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return '';
}

export function purchaseIdsEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalize Supabase jsonb RPC payloads into the purchase options shape.
 * Handles direct objects, JSON strings, and accidental `{ result: ... }` wrappers.
 */
export function parsePublicEventPurchaseOptions(
  data: unknown,
): GetPublicEventPurchaseOptionsResult | null {
  if (data == null) {
    return null;
  }

  let root: unknown = data;

  if (typeof root === 'string') {
    try {
      root = JSON.parse(root) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(root)) {
    return null;
  }

  if (!('event' in root) && 'result' in root) {
    root = root.result;
  }

  if (typeof root === 'string') {
    try {
      root = JSON.parse(root) as unknown;
    } catch {
      return null;
    }
  }

  if (!isRecord(root) || !isRecord(root.event)) {
    return null;
  }

  let ticketTypesRaw: unknown = root.ticket_types;

  if (typeof ticketTypesRaw === 'string') {
    try {
      ticketTypesRaw = JSON.parse(ticketTypesRaw) as unknown;
    } catch {
      ticketTypesRaw = [];
    }
  }

  if (!Array.isArray(ticketTypesRaw)) {
    return null;
  }

  return {
    event: root.event as GetPublicEventPurchaseOptionsResult['event'],
    ticket_types: ticketTypesRaw as PublicEventPurchaseTicketType[],
  };
}

export function findPurchaseTicketType(
  options: GetPublicEventPurchaseOptionsResult,
  ticketTypeId: string,
): PublicEventPurchaseTicketType | null {
  return (
    options.ticket_types.find((ticketType) => purchaseIdsEqual(ticketType.id, ticketTypeId)) ??
    null
  );
}

export function logPurchaseOptionsDiagnostics(details: {
  eventId: string;
  ticketTypeId: string;
  rpcError?: string | null;
  dataIsNull?: boolean;
  returnedTicketTypeIds?: string[];
  unavailableReason?: PurchaseUnavailableReason | 'ready' | 'loading' | 'error';
}): void {
  if (!__DEV__) {
    return;
  }

  console.debug('[purchase-options]', details);
}
