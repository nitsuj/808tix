/** Static fake data for /design/admin-dashboard-prototype only. */

export type PrototypeRange = 'daily' | 'weekly' | 'monthly';

export type PrototypeEventStatus = 'on_sale' | 'sales_ended' | 'draft' | 'cancelled';

export type PrototypeEventRow = {
  id: string;
  name: string;
  venue: string;
  organizer: string;
  dateLabel: string;
  status: PrototypeEventStatus;
  salesLabel: string;
  feeSource: string;
  orders: number;
  tickets: number;
  checkedIn: number;
  scanRate: string;
  grossCents: number;
  serviceFeeCents: number;
  processingFeeCents: number;
  organizerNetCents: number;
  thumbHue: string;
};

export const PROTOTYPE_DATE_RANGE = 'May 22 – Jun 21, 2025';

export const PROTOTYPE_KPIS = [
  {
    id: 'gmv',
    label: 'Gross Merchandise Value',
    value: '$312,845.62',
    trend: '↑ 18.7% vs prior period',
    tone: 'magenta' as const,
    spark: [18, 22, 20, 28, 26, 34, 40, 38, 44, 48],
  },
  {
    id: 'tickets',
    label: 'Tickets Sold',
    value: '18,420',
    trend: '↑ 12.4% vs prior period',
    tone: 'purple' as const,
    spark: [12, 14, 18, 16, 22, 24, 21, 28, 30, 33],
  },
  {
    id: 'pending',
    label: 'Pending Payouts',
    value: '$47,382.31',
    trend: '5 payouts awaiting',
    tone: 'rose' as const,
    spark: [30, 28, 32, 36, 34, 40, 42, 38, 44, 47],
  },
  {
    id: 'organizers',
    label: 'Active Organizers',
    value: '128',
    trend: '↑ 9 vs prior period',
    tone: 'green' as const,
    spark: [90, 94, 98, 100, 105, 110, 112, 118, 122, 128],
  },
  {
    id: 'service',
    label: 'Service Fee Revenue',
    value: '$18,768.42',
    trend: '↑ 16.3% vs prior period',
    tone: 'violet' as const,
    spark: [10, 12, 11, 14, 15, 16, 17, 16, 18, 19],
  },
] as const;

/** Normalized 0–1 points for the main GMV area chart (daily series). */
export const PROTOTYPE_CHART_SERIES: Record<PrototypeRange, number[]> = {
  daily: [0.18, 0.22, 0.28, 0.24, 0.42, 0.55, 0.48, 0.62, 0.7, 0.58, 0.74, 0.82, 0.68, 0.88, 0.92],
  weekly: [0.3, 0.38, 0.45, 0.52, 0.48, 0.66, 0.72, 0.8],
  monthly: [0.35, 0.48, 0.55, 0.7, 0.78, 0.9],
};

export const PROTOTYPE_CHART_LABELS: Record<PrototypeRange, string[]> = {
  daily: ['May 22', 'May 26', 'May 30', 'Jun 3', 'Jun 7', 'Jun 11', 'Jun 15', 'Jun 19'],
  weekly: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
  monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
};

export const PROTOTYPE_REVENUE_SPLIT = [
  { id: 'net', label: 'Organizer net', value: '$284,661.93', share: 0.72, color: '#39FF14' },
  { id: 'service', label: '808Tickets service fee', value: '$18,768.42', share: 0.18, color: '#FF2D78' },
  { id: 'processing', label: 'Payment processing fee', value: '$9,415.27', share: 0.1, color: '#7B8CFF' },
] as const;

export const PROTOTYPE_EVENTS: PrototypeEventRow[] = [
  {
    id: '1',
    name: 'Hoʻomau Summer Luau Festival',
    venue: 'Kapiolani Park',
    organizer: 'Hoʻomau Culture',
    dateLabel: 'Sat, Jul 19 · 5:00 PM HST',
    status: 'on_sale',
    salesLabel: 'Sales on',
    feeSource: 'Global',
    orders: 1248,
    tickets: 2840,
    checkedIn: 2800,
    scanRate: '98.6%',
    grossCents: 8520000,
    serviceFeeCents: 511200,
    processingFeeCents: 255600,
    organizerNetCents: 7753200,
    thumbHue: '#FF6B4A',
  },
  {
    id: '2',
    name: 'North Shore Night Market',
    venue: 'Haleiwa Town Center',
    organizer: '808 Markets Co',
    dateLabel: 'Fri, Jun 27 · 6:30 PM HST',
    status: 'on_sale',
    salesLabel: 'Sales on',
    feeSource: 'Organizer',
    orders: 842,
    tickets: 1684,
    checkedIn: 0,
    scanRate: '—',
    grossCents: 4210000,
    serviceFeeCents: 252600,
    processingFeeCents: 126300,
    organizerNetCents: 3831100,
    thumbHue: '#4AD4FF',
  },
  {
    id: '3',
    name: 'Kakaʻako Art Walk Afterparty',
    venue: 'SALT at Our Kakaʻako',
    organizer: 'Island Collective',
    dateLabel: 'Thu, May 29 · 8:00 PM HST',
    status: 'sales_ended',
    salesLabel: 'Sales off',
    feeSource: 'Event',
    orders: 510,
    tickets: 980,
    checkedIn: 942,
    scanRate: '96.1%',
    grossCents: 1960000,
    serviceFeeCents: 117600,
    processingFeeCents: 58800,
    organizerNetCents: 1783600,
    thumbHue: '#B44AFF',
  },
  {
    id: '4',
    name: 'Waikiki Jazz Sunset Series',
    venue: 'Fort DeRussy Lawn',
    organizer: 'Pacific Jazz League',
    dateLabel: 'Sun, Aug 3 · 4:00 PM HST',
    status: 'draft',
    salesLabel: 'Sales off',
    feeSource: 'Global',
    orders: 0,
    tickets: 0,
    checkedIn: 0,
    scanRate: '—',
    grossCents: 0,
    serviceFeeCents: 0,
    processingFeeCents: 0,
    organizerNetCents: 0,
    thumbHue: '#FFD166',
  },
  {
    id: '5',
    name: 'Aloha Bounce Warehouse',
    venue: 'Iwilei Industrial',
    organizer: 'Bounce Ops',
    dateLabel: 'Sat, Apr 12 · 9:00 PM HST',
    status: 'cancelled',
    salesLabel: 'Sales off',
    feeSource: 'Global',
    orders: 64,
    tickets: 120,
    checkedIn: 0,
    scanRate: '—',
    grossCents: 360000,
    serviceFeeCents: 21600,
    processingFeeCents: 10800,
    organizerNetCents: 327600,
    thumbHue: '#6B7280',
  },
];

/** Featured event for /design/admin-event-detail-prototype (static). */
export const PROTOTYPE_EVENT_DETAIL = {
  ...PROTOTYPE_EVENTS[0],
  organizerEmail: 'ops@hoomau.example',
  ticketingMode: 'Paid + comps',
  effectiveFeeSource: 'Global',
  monetization: {
    effective: '808Tickets service fee 250 bps + 99¢/ticket · Payment processing fee 290 bps + 30¢',
    global: '808Tickets service fee 250 bps + 99¢/ticket · Payment processing fee 290 bps + 30¢',
    organizerOverride: 'None',
    eventOverride: 'Inactive — using organizer/global effective config',
  },
  supportNote: 'Scanner requires an authenticated organizer/admin session.',
} as const;

export const PROTOTYPE_EVENT_ORDERS = [
  {
    id: 'ord-1',
    buyer: 'Mia Kealoha · mia@example.com',
    status: 'paid' as const,
    paidAt: 'Jul 12, 2025 · 3:42 PM',
    tickets: 4,
    feeSource: 'Global',
    subtotalCents: 12000,
    serviceFeeCents: 720,
    processingFeeCents: 360,
    netCents: 12000,
  },
  {
    id: 'ord-2',
    buyer: 'Noah Patel · noah@example.com',
    status: 'paid' as const,
    paidAt: 'Jul 11, 2025 · 9:18 AM',
    tickets: 2,
    feeSource: 'Global',
    subtotalCents: 6000,
    serviceFeeCents: 360,
    processingFeeCents: 180,
    netCents: 6000,
  },
  {
    id: 'ord-3',
    buyer: 'Ava Santos · ava@example.com',
    status: 'pending' as const,
    paidAt: '—',
    tickets: 1,
    feeSource: 'Global',
    subtotalCents: 3000,
    serviceFeeCents: 180,
    processingFeeCents: 90,
    netCents: 3000,
  },
] as const;

export const PROTOTYPE_EVENT_PAYOUTS = [
  {
    id: 'pay-1',
    amountCents: 420000,
    status: 'pending' as const,
    paidAt: '—',
    netCents: 420000,
    notes: 'Hold until T+3 after event',
  },
  {
    id: 'pay-2',
    amountCents: 185000,
    status: 'paid' as const,
    paidAt: 'May 4, 2025 · 1:05 PM',
    netCents: 185000,
    notes: 'Manual ACH confirmed',
  },
] as const;