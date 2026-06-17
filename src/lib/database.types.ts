export type CheckInResult =
  | 'valid'
  | 'already_used'
  | 'invalid'
  | 'wrong_event'
  | 'voided';

export type PassStatus = 'active' | 'checked_in' | 'voided';

export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';

export type TicketingMode = 'comp_only' | 'paid' | 'mixed';

export type PassSource = 'comp' | 'paid';

export type OrderStatus =
  | 'pending'
  | 'checkout_open'
  | 'paid'
  | 'expired'
  | 'canceled'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export type FeePayer = 'buyer' | 'organizer';

export type SettlementMode = 'platform' | 'connect';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export type PaymentEventProcessingStatus = 'received' | 'processed' | 'failed';

export type OrganizerPayoutStatus = 'pending' | 'paid' | 'withheld';

export type CreatePendingOrderResult = {
  order_id: string;
  public_access_token: string;
  status: OrderStatus;
  subtotal_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  organizer_net_cents: number;
  currency: string;
  reserved_until: string;
};

export type FulfillPaidOrderPass = {
  pass_id: string;
  secure_token: string;
  pass_type: string;
  guest_name: string;
  sequence: number;
};

export type FulfillPaidOrderResult = {
  order_id: string;
  status: OrderStatus;
  already_fulfilled: boolean;
  pass_count: number;
  passes: FulfillPaidOrderPass[];
};

export type PublicOrderTicket = {
  secure_token: string;
  pass_type: string;
  guest_name: string;
};

export type GetOrderByPublicTokenResult = {
  status: OrderStatus;
  event_name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  image_url: string | null;
  ticket_count: number;
  tickets: PublicOrderTicket[] | null;
};

export type PublicEventPurchaseOptionsEvent = {
  id: string;
  name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
  currency: string;
  capacity: number;
  ticketing_mode: TicketingMode;
  sales_enabled: boolean;
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
};

export type PublicEventPurchaseTicketType = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  capacity: number | null;
  quantity_available: number | null;
  sales_start_at: string | null;
  sales_end_at: string | null;
  sort_order: number;
};

export type GetPublicEventPurchaseOptionsResult = {
  event: PublicEventPurchaseOptionsEvent;
  ticket_types: PublicEventPurchaseTicketType[];
};

export type ExpireStaleOrdersResult = {
  expired_count: number;
};

export type ValidatePassResponse = {
  result: CheckInResult;
  pass_id?: string;
  guest_name?: string;
};

export type PublicPassView = {
  guest_name: string;
  pass_type: string;
  status: PassStatus;
  secure_token: string;
  event_name: string;
  event_slug: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
};

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  default_settlement_mode: SettlementMode;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  stripe_connect_payouts_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  organizer_id: string;
  slug: string;
  name: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
  capacity: number;
  status: EventStatus;
  ticketing_mode: TicketingMode;
  currency: string;
  platform_fee_bps: number;
  platform_fee_fixed_cents: number;
  sales_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Pass = {
  id: string;
  event_id: string;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  pass_type: string;
  secure_token: string;
  status: PassStatus;
  source: PassSource;
  order_id: string | null;
  order_item_id: string | null;
  ticket_type_id: string | null;
  sequence: number | null;
  price_paid_cents: number | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CheckIn = {
  id: string;
  pass_id: string | null;
  event_id: string;
  scanned_by: string;
  result: CheckInResult;
  scanned_at: string;
};

export type TicketType = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  capacity: number | null;
  sales_start_at: string | null;
  sales_end_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  event_id: string;
  organizer_id: string;
  status: OrderStatus;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  currency: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number | null;
  total_cents: number;
  organizer_net_cents: number;
  fee_payer: FeePayer;
  settlement_mode: SettlementMode;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  public_access_token: string;
  reserved_until: string | null;
  paid_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  ticket_type_id: string;
  quantity: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  pass_type_label: string;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_balance_transaction_id: string | null;
  processor_fee_cents: number | null;
  net_cents: number | null;
  paid_at: string | null;
  created_at: string;
};

export type PaymentEvent = {
  id: string;
  stripe_event_id: string;
  type: string;
  payload: Record<string, unknown>;
  order_id: string | null;
  processing_status: PaymentEventProcessingStatus;
  error: string | null;
  received_at: string;
  processed_at: string | null;
};

export type OrganizerPayout = {
  id: string;
  organizer_id: string;
  order_id: string;
  amount_cents: number;
  currency: string;
  status: OrganizerPayoutStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, 'id'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      events: {
        Row: Event;
        Insert: Partial<Event> & Pick<Event, 'organizer_id' | 'slug' | 'name' | 'capacity'>;
        Update: Partial<Event>;
        Relationships: [];
      };
      passes: {
        Row: Pass;
        Insert: Partial<Pass> & Pick<Pass, 'event_id' | 'guest_name' | 'pass_type'>;
        Update: Partial<Pass>;
        Relationships: [];
      };
      checkins: {
        Row: CheckIn;
        Insert: Partial<CheckIn> & Pick<CheckIn, 'event_id' | 'scanned_by' | 'result'>;
        Update: Partial<CheckIn>;
        Relationships: [];
      };
      ticket_types: {
        Row: TicketType;
        Insert: Partial<TicketType> & Pick<TicketType, 'event_id' | 'name' | 'price_cents'>;
        Update: Partial<TicketType>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Partial<Order> &
          Pick<Order, 'event_id' | 'organizer_id' | 'buyer_email' | 'public_access_token'>;
        Update: Partial<Order>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItem;
        Insert: Partial<OrderItem> &
          Pick<
            OrderItem,
            'order_id' | 'ticket_type_id' | 'quantity' | 'unit_price_cents' | 'line_subtotal_cents' | 'pass_type_label'
          >;
        Update: Partial<OrderItem>;
        Relationships: [];
      };
      payments: {
        Row: Payment;
        Insert: Partial<Payment> & Pick<Payment, 'order_id' | 'amount_cents'>;
        Update: Partial<Payment>;
        Relationships: [];
      };
      payment_events: {
        Row: PaymentEvent;
        Insert: Partial<PaymentEvent> &
          Pick<PaymentEvent, 'stripe_event_id' | 'type' | 'payload'>;
        Update: Partial<PaymentEvent>;
        Relationships: [];
      };
      organizer_payouts: {
        Row: OrganizerPayout;
        Insert: Partial<OrganizerPayout> &
          Pick<OrganizerPayout, 'organizer_id' | 'order_id' | 'amount_cents'>;
        Update: Partial<OrganizerPayout>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      validate_pass: {
        Args: {
          p_secure_token: string;
          p_event_id: string;
        };
        Returns: ValidatePassResponse;
      };
      get_pass_by_token: {
        Args: {
          p_secure_token: string;
        };
        Returns: PublicPassView | null;
      };
      get_event_stats: {
        Args: {
          p_event_id: string;
        };
        Returns: {
          issued_count: number;
          checked_in_count: number;
          capacity: number;
          remaining_count: number;
        };
      };
      ensure_organizer_profile: {
        Args: Record<string, never>;
        Returns: Profile;
      };
      generate_public_access_token: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_pending_order: {
        Args: {
          p_event_id: string;
          p_buyer_email: string;
          p_ticket_type_id: string;
          p_quantity: number;
          p_buyer_name?: string | null;
          p_buyer_phone?: string | null;
        };
        Returns: CreatePendingOrderResult;
      };
      fulfill_paid_order: {
        Args: {
          p_order_id: string;
          p_amount_cents: number;
          p_currency: string;
          p_stripe_checkout_session_id?: string | null;
          p_stripe_payment_intent_id?: string | null;
          p_stripe_charge_id?: string | null;
          p_processor_fee_cents?: number | null;
          p_net_cents?: number | null;
        };
        Returns: FulfillPaidOrderResult;
      };
      expire_stale_orders: {
        Args: Record<string, never>;
        Returns: ExpireStaleOrdersResult;
      };
      get_order_by_public_token: {
        Args: {
          p_public_access_token: string;
        };
        Returns: GetOrderByPublicTokenResult | null;
      };
      get_public_event_purchase_options: {
        Args: {
          p_event_id: string;
        };
        Returns: GetPublicEventPurchaseOptionsResult | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
