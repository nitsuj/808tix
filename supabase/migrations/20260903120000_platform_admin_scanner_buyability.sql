-- Platform admin scanner access + admin buyability signals.
-- Safe, minimal auth expansion: organizer OR is_platform_admin().
-- Does not change checkout fee math, fulfillment, or public purchase options.

-- ---------------------------------------------------------------------------
-- RLS: platform admin can SELECT events/passes (scanner event load + stats fallback)
-- ---------------------------------------------------------------------------
drop policy if exists events_select_platform_admin on public.events;
create policy events_select_platform_admin
  on public.events
  for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists passes_select_platform_admin on public.passes;
create policy passes_select_platform_admin
  on public.passes
  for select
  to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- get_event_stats: organizer OR platform admin
-- ---------------------------------------------------------------------------
create or replace function public.get_event_stats(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizer_id uuid;
  v_capacity integer;
  v_issued integer;
  v_checked_in integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  select organizer_id, capacity
  into v_organizer_id, v_capacity
  from public.events
  where id = p_event_id;

  if not found then
    raise exception 'Event not found'
      using errcode = 'P0002';
  end if;

  if v_organizer_id is distinct from auth.uid()
     and not public.is_platform_admin() then
    raise exception 'Access denied'
      using errcode = '42501';
  end if;

  select count(*)::integer
  into v_issued
  from public.passes
  where event_id = p_event_id
    and status in ('active', 'checked_in');

  select count(*)::integer
  into v_checked_in
  from public.passes
  where event_id = p_event_id
    and status = 'checked_in';

  return jsonb_build_object(
    'issued_count', v_issued,
    'checked_in_count', v_checked_in,
    'capacity', v_capacity,
    'remaining_count', greatest(v_capacity - v_issued, 0)
  );
end;
$$;

revoke all on function public.get_event_stats(uuid) from public;
grant execute on function public.get_event_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- validate_pass: organizer OR platform admin; unauthorized stays PII-free
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
  v_authorized boolean := false;
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

  v_authorized :=
    found
    and (
      v_event_organizer_id = v_scanned_by
      or public.is_platform_admin()
    );

  -- Unauthorized scanners must not receive guest_name / pass_id.
  if not v_authorized then
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

-- ---------------------------------------------------------------------------
-- Buyability helper (mirrors get_public_event_purchase_options gates)
-- ---------------------------------------------------------------------------
create or replace function public.compute_event_buyability(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_event_issued integer;
  v_event_reserved integer;
  v_active_count integer := 0;
  v_sellable_count integer := 0;
  v_quantity_available integer := null;
  v_has_unlimited boolean := false;
  v_status text;
  v_label text;
  v_is_buyable boolean := false;
begin
  select *
  into v_event
  from public.events
  where id = p_event_id;

  if not found then
    return jsonb_build_object(
      'buyability_status', 'not_buyable',
      'buyability_label', 'Not buyable',
      'is_buyable', false,
      'active_ticket_type_count', 0,
      'ticket_quantity_available', 0
    );
  end if;

  if v_event.status = 'draft' then
    v_status := 'draft';
    v_label := 'Draft';
  elsif v_event.status in ('canceled', 'cancelled') then
    v_status := 'canceled';
    v_label := 'Canceled';
  elsif v_event.status is distinct from 'published' then
    v_status := 'not_buyable';
    v_label := 'Not buyable';
  elsif not coalesce(v_event.sales_enabled, false) then
    v_status := 'sales_off';
    v_label := 'Sales off';
  elsif v_event.ticketing_mode not in ('paid', 'mixed') then
    v_status := 'not_buyable';
    v_label := 'Not buyable';
  else
    v_event_issued := public.event_issued_pass_count(p_event_id);
    v_event_reserved := public.event_reserved_pass_count(p_event_id);

    select
      count(*)::integer,
      count(*) filter (
        where qty is null or qty > 0
      )::integer,
      bool_or(qty is null),
      case
        when bool_or(qty is null) then null
        else coalesce(sum(qty), 0)::integer
      end
    into
      v_active_count,
      v_sellable_count,
      v_has_unlimited,
      v_quantity_available
    from (
      select
        case
          when v_event.capacity is not null and tt.capacity is not null then
            least(
              greatest(v_event.capacity - v_event_issued - v_event_reserved, 0),
              greatest(
                tt.capacity
                - public.ticket_type_issued_pass_count(tt.id)
                - public.ticket_type_reserved_pass_count(tt.id),
                0
              )
            )
          when v_event.capacity is not null then
            greatest(v_event.capacity - v_event_issued - v_event_reserved, 0)
          when tt.capacity is not null then
            greatest(
              tt.capacity
              - public.ticket_type_issued_pass_count(tt.id)
              - public.ticket_type_reserved_pass_count(tt.id),
              0
            )
          else null
        end as qty
      from public.ticket_types tt
      where tt.event_id = p_event_id
        and tt.is_active = true
        and (tt.sales_start_at is null or tt.sales_start_at <= now())
        and (tt.sales_end_at is null or tt.sales_end_at >= now())
    ) q;

    if v_active_count = 0 then
      v_status := 'no_tickets';
      v_label := 'No tickets';
      v_quantity_available := 0;
    elsif v_sellable_count = 0 and not v_has_unlimited then
      v_status := 'sold_out';
      v_label := 'Sold out';
      v_quantity_available := 0;
    else
      v_status := 'selling';
      v_label := 'Selling';
      v_is_buyable := true;
    end if;
  end if;

  return jsonb_build_object(
    'buyability_status', v_status,
    'buyability_label', v_label,
    'is_buyable', v_is_buyable,
    'active_ticket_type_count', coalesce(v_active_count, 0),
    'ticket_quantity_available', v_quantity_available
  );
end;
$$;

revoke all on function public.compute_event_buyability(uuid) from public;
-- Called only from platform-admin DEFINER RPCs; no direct client grant.

-- ---------------------------------------------------------------------------
-- admin_list_events: include buyability fields
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_events(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(y.merged order by y.sort_date desc nulls last, y.created_at desc)
    from (
      select
        row_to_json(x)::jsonb || public.compute_event_buyability(x.event_id) as merged,
        x.sort_date,
        x.created_at
      from (
        select
          e.id as event_id,
          e.name as event_name,
          e.slug as event_slug,
          e.status,
          e.sales_enabled,
          e.ticketing_mode,
          e.event_date,
          e.start_time,
          e.venue_name,
          e.organizer_id,
          p.email as organizer_email,
          p.full_name as organizer_name,
          e.use_custom_fees,
          (public.resolve_effective_fee_config(e.id) ->> 'source') as fee_config_source,
          e.created_at,
          coalesce(e.event_date::timestamptz, e.created_at) as sort_date,
          (
            select count(*)::integer from public.orders o
            where o.event_id = e.id and o.status = 'paid'
          ) as paid_order_count,
          (
            select count(*)::integer from public.passes ps
            where ps.event_id = e.id and ps.source = 'paid'
          ) as paid_ticket_count,
          (
            select count(*)::integer from public.passes ps
            where ps.event_id = e.id and ps.status = 'checked_in'
          ) as checked_in_count,
          (
            select coalesce(sum(o.subtotal_cents), 0)::bigint from public.orders o
            where o.event_id = e.id and o.status = 'paid'
          ) as ticket_subtotal_cents,
          (
            select coalesce(sum(o.platform_fee_cents), 0)::bigint from public.orders o
            where o.event_id = e.id and o.status = 'paid'
          ) as platform_fee_cents,
          (
            select coalesce(sum(coalesce(o.processing_fee_cents, 0)), 0)::bigint from public.orders o
            where o.event_id = e.id and o.status = 'paid'
          ) as processing_fee_cents,
          (
            select coalesce(sum(o.organizer_net_cents), 0)::bigint from public.orders o
            where o.event_id = e.id and o.status = 'paid'
          ) as organizer_net_cents,
          (
            select coalesce(
              jsonb_agg(distinct op.status),
              '[]'::jsonb
            )
            from public.organizer_payouts op
            join public.orders o on o.id = op.order_id
            where o.event_id = e.id
          ) as payout_statuses
        from public.events e
        join public.profiles p on p.id = e.organizer_id
        order by coalesce(e.event_date::timestamptz, e.created_at) desc nulls last
        limit v_limit
      ) x
    ) y
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_events(integer) from public;
grant execute on function public.admin_list_events(integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_get_event_detail: include buyability fields
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_event_detail(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception 'event_id required' using errcode = '22023';
  end if;

  select row_to_json(x)::jsonb || public.compute_event_buyability(p_event_id)
  into v_row
  from (
    select
      e.id as event_id,
      e.name as event_name,
      e.slug as event_slug,
      e.status,
      e.sales_enabled,
      e.ticketing_mode,
      e.event_date,
      e.start_time,
      e.venue_name,
      e.organizer_id,
      p.email as organizer_email,
      p.full_name as organizer_name,
      e.use_custom_fees,
      e.platform_fee_bps,
      e.platform_fee_fixed_cents,
      e.processing_fee_bps,
      e.processing_fee_fixed_cents,
      (public.resolve_effective_fee_config(e.id) ->> 'source') as fee_config_source,
      (
        select count(*)::integer from public.orders o
        where o.event_id = e.id and o.status = 'paid'
      ) as paid_order_count,
      (
        select count(*)::integer from public.passes ps
        where ps.event_id = e.id and ps.source = 'paid'
      ) as paid_ticket_count,
      (
        select count(*)::integer from public.passes ps
        where ps.event_id = e.id and ps.status = 'checked_in'
      ) as checked_in_count,
      (
        select coalesce(sum(o.subtotal_cents), 0)::bigint from public.orders o
        where o.event_id = e.id and o.status = 'paid'
      ) as ticket_subtotal_cents,
      (
        select coalesce(sum(o.platform_fee_cents), 0)::bigint from public.orders o
        where o.event_id = e.id and o.status = 'paid'
      ) as platform_fee_cents,
      (
        select coalesce(sum(coalesce(o.processing_fee_cents, 0)), 0)::bigint from public.orders o
        where o.event_id = e.id and o.status = 'paid'
      ) as processing_fee_cents,
      (
        select coalesce(sum(o.organizer_net_cents), 0)::bigint from public.orders o
        where o.event_id = e.id and o.status = 'paid'
      ) as organizer_net_cents,
      (
        select coalesce(jsonb_agg(distinct op.status), '[]'::jsonb)
        from public.organizer_payouts op
        join public.orders o on o.id = op.order_id
        where o.event_id = e.id
      ) as payout_statuses
    from public.events e
    join public.profiles p on p.id = e.organizer_id
    where e.id = p_event_id
  ) x;

  if v_row is null then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_get_event_detail(uuid) from public;
grant execute on function public.admin_get_event_detail(uuid) to authenticated, service_role;
