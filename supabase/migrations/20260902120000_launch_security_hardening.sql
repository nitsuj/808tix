-- Launch security hardening (audit H1–H3, M1–M2).
-- Does not change checkout fee math formulas or fulfill_paid_order amount matching.

-- ---------------------------------------------------------------------------
-- H2: create_pending_order — max quantity + service_role only
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_order(
  p_event_id uuid,
  p_buyer_email text,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_buyer_name text default null,
  p_buyer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_ticket_type public.ticket_types%rowtype;
  v_buyer_email text;
  v_subtotal_cents integer;
  v_fee_cfg jsonb;
  v_fees jsonb;
  v_platform_fee_cents integer;
  v_processing_fee_cents integer;
  v_total_cents integer;
  v_organizer_net_cents integer;
  v_order_id uuid;
  v_public_access_token text;
  v_reserved_until timestamptz;
  v_issued integer;
  v_reserved integer;
  v_tt_issued integer;
  v_tt_reserved integer;
  v_available integer;
  v_source text;
  v_platform_fee_bps integer;
  v_platform_fee_fixed_cents integer;
  v_processing_fee_bps integer;
  v_processing_fee_fixed_cents integer;
  v_max_quantity constant integer := 10;
begin
  v_buyer_email := btrim(coalesce(p_buyer_email, ''));

  if v_buyer_email = '' then
    raise exception 'buyer_email is required' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than zero' using errcode = '22023';
  end if;

  if p_quantity > v_max_quantity then
    raise exception 'quantity cannot exceed %', v_max_quantity using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  if v_event.status <> 'published' then
    raise exception 'Event is not published' using errcode = '22023';
  end if;

  if not v_event.sales_enabled then
    raise exception 'Ticket sales are not enabled for this event' using errcode = '22023';
  end if;

  if v_event.ticketing_mode not in ('paid', 'mixed') then
    raise exception 'Event does not support paid ticketing' using errcode = '22023';
  end if;

  select * into v_ticket_type from public.ticket_types where id = p_ticket_type_id for update;
  if not found then
    raise exception 'Ticket type not found' using errcode = 'P0002';
  end if;

  if v_ticket_type.event_id is distinct from p_event_id then
    raise exception 'Ticket type does not belong to this event' using errcode = '22023';
  end if;

  if not v_ticket_type.is_active then
    raise exception 'Ticket type is not active' using errcode = '22023';
  end if;

  if v_ticket_type.sales_start_at is not null and v_ticket_type.sales_start_at > now() then
    raise exception 'Ticket sales have not started yet' using errcode = '22023';
  end if;

  if v_ticket_type.sales_end_at is not null and v_ticket_type.sales_end_at < now() then
    raise exception 'Ticket sales have ended' using errcode = '22023';
  end if;

  v_fee_cfg := public.resolve_effective_fee_config(p_event_id);
  v_source := v_fee_cfg ->> 'source';
  v_platform_fee_bps := (v_fee_cfg ->> 'platform_fee_bps')::integer;
  v_platform_fee_fixed_cents := (v_fee_cfg ->> 'platform_fee_fixed_cents')::integer;
  v_processing_fee_bps := (v_fee_cfg ->> 'processing_fee_bps')::integer;
  v_processing_fee_fixed_cents := (v_fee_cfg ->> 'processing_fee_fixed_cents')::integer;

  v_subtotal_cents := v_ticket_type.price_cents * p_quantity;
  v_fees := public.calculate_order_fees(
    v_subtotal_cents,
    p_quantity,
    v_platform_fee_bps,
    v_platform_fee_fixed_cents,
    v_processing_fee_bps,
    v_processing_fee_fixed_cents
  );
  v_platform_fee_cents := (v_fees ->> 'platform_fee_cents')::integer;
  v_processing_fee_cents := (v_fees ->> 'processing_fee_cents')::integer;
  v_total_cents := (v_fees ->> 'total_cents')::integer;
  v_organizer_net_cents := v_subtotal_cents;

  v_issued := public.event_issued_pass_count(p_event_id);
  v_reserved := public.event_reserved_pass_count(p_event_id);
  v_available := v_event.capacity - v_issued - v_reserved;

  if p_quantity > v_available then
    raise exception 'Not enough event capacity (% available, % requested)', v_available, p_quantity
      using errcode = 'check_violation';
  end if;

  if v_ticket_type.capacity is not null then
    v_tt_issued := public.ticket_type_issued_pass_count(p_ticket_type_id);
    v_tt_reserved := public.ticket_type_reserved_pass_count(p_ticket_type_id);
    v_available := v_ticket_type.capacity - v_tt_issued - v_tt_reserved;
    if p_quantity > v_available then
      raise exception 'Not enough ticket type capacity (% available, % requested)', v_available, p_quantity
        using errcode = 'check_violation';
    end if;
  end if;

  v_public_access_token := public.generate_public_access_token();
  v_reserved_until := now() + interval '30 minutes';

  insert into public.orders (
    event_id,
    organizer_id,
    status,
    buyer_email,
    buyer_name,
    buyer_phone,
    currency,
    subtotal_cents,
    platform_fee_cents,
    processing_fee_cents,
    total_cents,
    organizer_net_cents,
    fee_payer,
    settlement_mode,
    public_access_token,
    reserved_until,
    fee_config_source,
    platform_fee_bps_used,
    platform_fee_fixed_cents_used,
    processing_fee_bps_used,
    processing_fee_fixed_cents_used
  )
  values (
    p_event_id,
    v_event.organizer_id,
    'pending',
    v_buyer_email,
    nullif(btrim(coalesce(p_buyer_name, '')), ''),
    nullif(btrim(coalesce(p_buyer_phone, '')), ''),
    v_event.currency,
    v_subtotal_cents,
    v_platform_fee_cents,
    v_processing_fee_cents,
    v_total_cents,
    v_organizer_net_cents,
    'buyer',
    'platform',
    v_public_access_token,
    v_reserved_until,
    v_source,
    v_platform_fee_bps,
    v_platform_fee_fixed_cents,
    v_processing_fee_bps,
    v_processing_fee_fixed_cents
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    ticket_type_id,
    quantity,
    unit_price_cents,
    line_subtotal_cents,
    pass_type_label
  )
  values (
    v_order_id,
    p_ticket_type_id,
    p_quantity,
    v_ticket_type.price_cents,
    v_subtotal_cents,
    v_ticket_type.name
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'public_access_token', v_public_access_token,
    'status', 'pending',
    'subtotal_cents', v_subtotal_cents,
    'platform_fee_cents', v_platform_fee_cents,
    'processing_fee_cents', v_processing_fee_cents,
    'total_cents', v_total_cents,
    'organizer_net_cents', v_organizer_net_cents,
    'fee_config_source', v_source,
    'currency', v_event.currency,
    'reserved_until', v_reserved_until
  );
end;
$$;

revoke all on function public.create_pending_order(uuid, text, uuid, integer, text, text) from public;
revoke all on function public.create_pending_order(uuid, text, uuid, integer, text, text) from anon, authenticated;
grant execute on function public.create_pending_order(uuid, text, uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- M2: resolve_effective_fee_config — not anon-callable
-- (create_pending_order / get_public_event_purchase_options still call it as DEFINER)
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_effective_fee_config(uuid) from public;
revoke all on function public.resolve_effective_fee_config(uuid) from anon;
grant execute on function public.resolve_effective_fee_config(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- H3: always server-generate secure_token; freeze token + paid identity fields
-- ---------------------------------------------------------------------------
create or replace function public.set_pass_secure_token()
returns trigger
language plpgsql
as $$
declare
  v_bypass boolean;
begin
  v_bypass :=
    current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  if tg_op = 'INSERT' then
    -- Always overwrite client-supplied tokens with 256-bit entropy.
    new.secure_token := encode(extensions.gen_random_bytes(32), 'hex');
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Never allow clients to rotate pass tokens.
    new.secure_token := old.secure_token;

    if not v_bypass and old.source = 'paid' then
      new.source := old.source;
      new.event_id := old.event_id;
      new.order_id := old.order_id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists passes_set_secure_token on public.passes;
create trigger passes_set_secure_token
  before insert or update on public.passes
  for each row
  execute function public.set_pass_secure_token();

create or replace function public.prevent_paid_pass_delete()
returns trigger
language plpgsql
as $$
declare
  v_bypass boolean;
begin
  v_bypass :=
    current_user in ('postgres', 'supabase_admin')
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  if not v_bypass and old.source = 'paid' then
    raise exception 'Paid tickets cannot be deleted'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists passes_prevent_paid_delete on public.passes;
create trigger passes_prevent_paid_delete
  before delete on public.passes
  for each row
  execute function public.prevent_paid_pass_delete();

-- ---------------------------------------------------------------------------
-- M1: validate_pass — no PII for unauthorized scanners
-- ---------------------------------------------------------------------------
create or replace function public.validate_pass(
  p_secure_token text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanned_by uuid;
  v_token text;
  v_pass public.passes%rowtype;
  v_event_organizer_id uuid;
  v_event_status text;
  v_result text;
  v_updated_pass public.passes%rowtype;
  v_final_status text;
  v_pass_found boolean := false;
begin
  v_scanned_by := auth.uid();
  if v_scanned_by is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  v_token := btrim(coalesce(p_secure_token, ''));

  select organizer_id, status
  into v_event_organizer_id, v_event_status
  from public.events
  where id = p_event_id;

  if not found or v_event_organizer_id is distinct from v_scanned_by then
    if v_token <> '' then
      select *
      into v_pass
      from public.passes
      where secure_token = v_token;

      v_pass_found := found;
    end if;

    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (
      case when v_pass_found then v_pass.id else null end,
      p_event_id,
      v_scanned_by,
      'invalid'
    );

    -- Unauthorized scanners must not receive guest_name / pass_id.
    return jsonb_build_object('result', 'invalid');
  end if;

  if v_event_status is distinct from 'published' then
    if v_token <> '' then
      select *
      into v_pass
      from public.passes
      where secure_token = v_token;

      v_pass_found := found;
    end if;

    if v_pass_found then
      return jsonb_build_object(
        'result', 'invalid',
        'pass_id', v_pass.id,
        'guest_name', v_pass.guest_name
      );
    end if;

    return jsonb_build_object('result', 'invalid');
  end if;

  if v_token = '' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (null, p_event_id, v_scanned_by, 'invalid');

    return jsonb_build_object('result', 'invalid');
  end if;

  select *
  into v_pass
  from public.passes
  where secure_token = v_token;

  if not found then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (null, p_event_id, v_scanned_by, 'invalid');

    return jsonb_build_object('result', 'invalid');
  end if;

  if v_pass.event_id is distinct from p_event_id then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'wrong_event');

    return jsonb_build_object(
      'result', 'wrong_event',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  if v_pass.status = 'voided' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'voided');

    return jsonb_build_object(
      'result', 'voided',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  if v_pass.status = 'checked_in' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'already_used');

    return jsonb_build_object(
      'result', 'already_used',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  perform set_config('app.allow_pass_status_update', 'true', true);

  v_updated_pass := null;

  update public.passes
  set
    status = 'checked_in',
    checked_in_at = now(),
    checked_in_by = v_scanned_by,
    updated_at = now()
  where id = v_pass.id
    and status = 'active'
  returning *
  into v_updated_pass;

  perform set_config('app.allow_pass_status_update', 'false', true);

  if v_updated_pass.id is not null then
    v_result := 'valid';
  else
    select status
    into v_final_status
    from public.passes
    where id = v_pass.id;

    if v_final_status = 'checked_in' then
      v_result := 'already_used';
    elsif v_final_status = 'voided' then
      v_result := 'voided';
    else
      v_result := 'invalid';
    end if;
  end if;

  insert into public.checkins (pass_id, event_id, scanned_by, result)
  values (v_pass.id, p_event_id, v_scanned_by, v_result);

  return jsonb_build_object(
    'result', v_result,
    'pass_id', v_pass.id,
    'guest_name', v_pass.guest_name
  );
end;
$$;

revoke all on function public.validate_pass(text, uuid) from public;
grant execute on function public.validate_pass(text, uuid) to authenticated;
