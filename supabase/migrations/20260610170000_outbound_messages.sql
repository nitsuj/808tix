-- 808Tix Phase 1.6: outbound message idempotency + audit (email/SMS foundation).
-- No provider integration in this migration — logging table only.

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete set null,
  recipient text not null,
  channel text not null,
  message_type text not null,
  status text not null default 'pending',
  provider text,
  provider_message_id text,
  error text,
  attempt_count integer not null default 0,
  idempotency_key text not null,
  payload_snapshot jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_messages_channel_check check (channel in ('email', 'sms')),
  constraint outbound_messages_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  constraint outbound_messages_idempotency_key_unique unique (idempotency_key),
  constraint outbound_messages_attempt_count_nonneg_check check (attempt_count >= 0)
);

create index outbound_messages_order_id_idx
  on public.outbound_messages (order_id);

create index outbound_messages_channel_message_type_status_idx
  on public.outbound_messages (channel, message_type, status);

create index outbound_messages_created_at_desc_idx
  on public.outbound_messages (created_at desc);

create trigger outbound_messages_set_updated_at
  before update on public.outbound_messages
  for each row
  execute function public.set_updated_at();

alter table public.outbound_messages enable row level security;

-- No anon/authenticated policies — service role (Edge Functions) bypasses RLS.
