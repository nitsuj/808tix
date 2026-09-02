import type { StatusBadgeTone } from '@/components/dashboard/status-badge';

/** Static mock data for /design/admin-event-detail-review only. */

export type EventAdminOrderTicket = {
  secureToken: string;
  sequence: number;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  ticketTypeLabel: string;
};

export type EventAdminOrder = {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  paidAtLabel: string;
  ticketCount: number;
  ticketTypeSummary: string;
  ticketSubtotalLabel: string;
  platformFeeLabel: string;
  processingFeeLabel: string;
  organizerNetLabel: string;
  tickets: EventAdminOrderTicket[];
};

export type EventAdminPayout = {
  payoutId: string;
  amountLabel: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  statusValue: 'pending' | 'paid' | 'withheld';
  paidAtLabel: string | null;
  notes: string;
};

export type EventAdminFeeSlice = {
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  processing_fee_bps: number;
  processing_fee_fixed_cents: number;
};

export type EventAdminDetail = {
  eventId: string;
  eventName: string;
  organizerName: string;
  organizerEmail: string;
  venueName: string;
  venueAddress: string;
  whenLabel: string;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  salesLabel: string;
  salesTone: StatusBadgeTone;
  feeSourceLabel: string;
  payoutLabel: string;
  payoutTone: StatusBadgeTone;
  ticketingModeLabel: string;
  grossTicketSalesLabel: string;
  ticketsSold: number;
  orders: number;
  checkedIn: number;
  platformFeeLabel: string;
  processingFeeLabel: string;
  organizerNetLabel: string;
  pendingPayoutLabel: string;
};

export const EVENT_REVIEW_DETAIL: EventAdminDetail = {
  eventId: 'review-event-paid-show',
  eventName: 'Test Paid Show',
  organizerName: 'Howzit Beer Co.',
  organizerEmail: 'organizer@example.com',
  venueName: 'Howzit',
  venueAddress: '330 Kamani St, Honolulu, HI',
  whenLabel: 'Thu, Jul 23, 2026 · 11:48 AM',
  statusLabel: 'Published',
  statusTone: 'positive',
  salesLabel: 'Sales on',
  salesTone: 'positive',
  feeSourceLabel: 'Global',
  payoutLabel: 'Pending',
  payoutTone: 'warn',
  ticketingModeLabel: 'Paid',
  grossTicketSalesLabel: '$1,250.00',
  ticketsSold: 42,
  orders: 18,
  checkedIn: 11,
  platformFeeLabel: '$73.08',
  processingFeeLabel: '$41.55',
  organizerNetLabel: '$1,250.00',
  pendingPayoutLabel: '$1,250.00',
};

export const EVENT_REVIEW_CHART_SERIES = [
  0.12, 0.22, 0.28, 0.35, 0.42, 0.48, 0.55, 0.61, 0.7, 0.78, 0.86, 0.94,
] as const;

export const EVENT_REVIEW_CHART_LABELS = [
  'Jul 1',
  'Jul 3',
  'Jul 5',
  'Jul 7',
  'Jul 9',
  'Jul 11',
  'Jul 13',
  'Jul 15',
  'Jul 17',
  'Jul 19',
  'Jul 21',
  'Jul 23',
] as const;

export const EVENT_REVIEW_CHART_Y_AXIS: [string, string, string] = ['$0', '$600', '$1.2K'];

export const EVENT_REVIEW_ORDERS: EventAdminOrder[] = [
  {
    orderId: 'ord_review_1',
    buyerName: 'Aloha Kealoha',
    buyerEmail: 'aloha@example.com',
    statusLabel: 'Paid',
    statusTone: 'positive',
    paidAtLabel: 'Jul 12, 2026 · 3:14 PM',
    ticketCount: 2,
    ticketTypeSummary: 'General Admission × 2',
    ticketSubtotalLabel: '$50.00',
    platformFeeLabel: '$3.23',
    processingFeeLabel: '$1.90',
    organizerNetLabel: '$50.00',
    tickets: [
      {
        secureToken: 'rev-pass-001',
        sequence: 1,
        statusLabel: 'Checked in',
        statusTone: 'positive',
        ticketTypeLabel: 'General Admission',
      },
      {
        secureToken: 'rev-pass-002',
        sequence: 2,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'General Admission',
      },
    ],
  },
  {
    orderId: 'ord_review_2',
    buyerName: 'Maya Santos',
    buyerEmail: 'maya@example.com',
    statusLabel: 'Paid',
    statusTone: 'positive',
    paidAtLabel: 'Jul 14, 2026 · 9:02 AM',
    ticketCount: 4,
    ticketTypeSummary: 'VIP × 2 · General Admission × 2',
    ticketSubtotalLabel: '$180.00',
    platformFeeLabel: '$9.48',
    processingFeeLabel: '$5.52',
    organizerNetLabel: '$180.00',
    tickets: [
      {
        secureToken: 'rev-pass-003',
        sequence: 1,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'VIP',
      },
      {
        secureToken: 'rev-pass-004',
        sequence: 2,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'VIP',
      },
      {
        secureToken: 'rev-pass-005',
        sequence: 3,
        statusLabel: 'Checked in',
        statusTone: 'positive',
        ticketTypeLabel: 'General Admission',
      },
      {
        secureToken: 'rev-pass-006',
        sequence: 4,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'General Admission',
      },
    ],
  },
  {
    orderId: 'ord_review_3',
    buyerName: 'Jordan Lee',
    buyerEmail: 'jordan@example.com',
    statusLabel: 'Refunded',
    statusTone: 'warn',
    paidAtLabel: 'Jul 10, 2026 · 6:41 PM',
    ticketCount: 1,
    ticketTypeSummary: 'General Admission × 1',
    ticketSubtotalLabel: '$25.00',
    platformFeeLabel: '$1.62',
    processingFeeLabel: '$1.03',
    organizerNetLabel: '$0.00',
    tickets: [
      {
        secureToken: 'rev-pass-007',
        sequence: 1,
        statusLabel: 'Voided',
        statusTone: 'cancelled',
        ticketTypeLabel: 'General Admission',
      },
    ],
  },
  {
    orderId: 'ord_review_4',
    buyerName: 'Comp Guest',
    buyerEmail: 'guestlist@howzit.beer',
    statusLabel: 'Comp',
    statusTone: 'draft',
    paidAtLabel: 'Jul 18, 2026 · 12:00 PM',
    ticketCount: 2,
    ticketTypeSummary: 'Comp × 2',
    ticketSubtotalLabel: '$0.00',
    platformFeeLabel: '$0.00',
    processingFeeLabel: '$0.00',
    organizerNetLabel: '$0.00',
    tickets: [
      {
        secureToken: 'rev-pass-008',
        sequence: 1,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'Comp',
      },
      {
        secureToken: 'rev-pass-009',
        sequence: 2,
        statusLabel: 'Checked in',
        statusTone: 'positive',
        ticketTypeLabel: 'Comp',
      },
    ],
  },
  {
    orderId: 'ord_review_5',
    buyerName: 'Kai Nakamura',
    buyerEmail: 'kai@example.com',
    statusLabel: 'Paid',
    statusTone: 'positive',
    paidAtLabel: 'Jul 20, 2026 · 8:55 PM',
    ticketCount: 3,
    ticketTypeSummary: 'General Admission × 3',
    ticketSubtotalLabel: '$75.00',
    platformFeeLabel: '$4.87',
    processingFeeLabel: '$2.48',
    organizerNetLabel: '$75.00',
    tickets: [
      {
        secureToken: 'rev-pass-010',
        sequence: 1,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'General Admission',
      },
      {
        secureToken: 'rev-pass-011',
        sequence: 2,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'General Admission',
      },
      {
        secureToken: 'rev-pass-012',
        sequence: 3,
        statusLabel: 'Valid',
        statusTone: 'neutral',
        ticketTypeLabel: 'General Admission',
      },
    ],
  },
];

export const EVENT_REVIEW_PAYOUT: EventAdminPayout = {
  payoutId: 'payout_review_1',
  amountLabel: '$1,250.00',
  statusLabel: 'Pending',
  statusTone: 'warn',
  statusValue: 'pending',
  paidAtLabel: null,
  notes: 'Hold until event settles · Howzit Beer Co. ACH on file',
};

export const EVENT_REVIEW_GLOBAL_FEES: EventAdminFeeSlice = {
  platform_fee_bps: 250,
  platform_fee_fixed_cents: 99,
  processing_fee_bps: 290,
  processing_fee_fixed_cents: 30,
};

export const EVENT_REVIEW_ORGANIZER_OVERRIDE: EventAdminFeeSlice | null = null;

export const EVENT_REVIEW_EVENT_OVERRIDE_DRAFT: EventAdminFeeSlice = {
  platform_fee_bps: 200,
  platform_fee_fixed_cents: 75,
  processing_fee_bps: 290,
  processing_fee_fixed_cents: 30,
};

export const EVENT_REVIEW_BUY_PATH = '/events/review-event-paid-show/buy';
export const EVENT_REVIEW_SCAN_PATH = '/events/review-event-paid-show/scan';
