-- Platform admin event-detail RPCs for /admin/events/:eventId.
-- Read/list only plus reuse of existing admin_set_event_custom_fees / admin_list_payouts.
-- Does not change checkout fee math or resolve_effective_fee_config semantics.

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

  select row_to_json(x)::jsonb
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

create or replace function public.admin_list_event_orders(
  p_event_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 300));
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception 'event_id required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        o.id as order_id,
        o.public_access_token,
        o.status,
        o.buyer_email,
        o.buyer_name,
        o.event_id,
        e.name as event_name,
        o.subtotal_cents,
        o.platform_fee_cents,
        o.processing_fee_cents,
        o.total_cents,
        o.organizer_net_cents,
        o.fee_config_source,
        o.platform_fee_bps_used,
        o.platform_fee_fixed_cents_used,
        o.processing_fee_bps_used,
        o.processing_fee_fixed_cents_used,
        o.currency,
        o.created_at,
        o.paid_at,
        (
          select count(*)::integer from public.passes ps where ps.order_id = o.id
        ) as ticket_count,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'secure_token', ps.secure_token,
                'sequence', ps.sequence,
                'status', ps.status
              )
              order by ps.sequence nulls last, ps.created_at
            ),
            '[]'::jsonb
          )
          from public.passes ps
          where ps.order_id = o.id
        ) as tickets
      from public.orders o
      join public.events e on e.id = o.event_id
      where o.event_id = p_event_id
      order by o.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_event_orders(uuid, integer) from public;
grant execute on function public.admin_list_event_orders(uuid, integer) to authenticated, service_role;

create or replace function public.admin_get_event_monetization(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_global public.platform_fee_config%rowtype;
  v_override public.organizer_fee_overrides%rowtype;
  v_effective jsonb;
  v_organizer_email text;
  v_organizer_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  if p_event_id is null then
    raise exception 'event_id required' using errcode = '22023';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select * into v_global from public.platform_fee_config where id = 1;
  select * into v_override
  from public.organizer_fee_overrides
  where organizer_id = v_event.organizer_id;

  select p.email, p.full_name
  into v_organizer_email, v_organizer_name
  from public.profiles p
  where p.id = v_event.organizer_id;

  v_effective := public.resolve_effective_fee_config(p_event_id);

  return jsonb_build_object(
    'event_id', v_event.id,
    'use_custom_fees', v_event.use_custom_fees,
    'event_override', case
      when v_event.use_custom_fees then jsonb_build_object(
        'platform_fee_bps', v_event.platform_fee_bps,
        'platform_fee_fixed_cents', v_event.platform_fee_fixed_cents,
        'processing_fee_bps', v_event.processing_fee_bps,
        'processing_fee_fixed_cents', v_event.processing_fee_fixed_cents
      )
      else null
    end,
    'event_stored_fees', jsonb_build_object(
      'platform_fee_bps', v_event.platform_fee_bps,
      'platform_fee_fixed_cents', v_event.platform_fee_fixed_cents,
      'processing_fee_bps', v_event.processing_fee_bps,
      'processing_fee_fixed_cents', v_event.processing_fee_fixed_cents
    ),
    'organizer_override', case
      when v_override.organizer_id is not null then jsonb_build_object(
        'organizer_id', v_override.organizer_id,
        'organizer_email', v_organizer_email,
        'organizer_name', v_organizer_name,
        'platform_fee_bps', v_override.platform_fee_bps,
        'platform_fee_fixed_cents', v_override.platform_fee_fixed_cents,
        'processing_fee_bps', v_override.processing_fee_bps,
        'processing_fee_fixed_cents', v_override.processing_fee_fixed_cents
      )
      else null
    end,
    'global', jsonb_build_object(
      'platform_fee_bps', v_global.platform_fee_bps,
      'platform_fee_fixed_cents', v_global.platform_fee_fixed_cents,
      'processing_fee_bps', v_global.processing_fee_bps,
      'processing_fee_fixed_cents', v_global.processing_fee_fixed_cents,
      'updated_at', v_global.updated_at
    ),
    'effective', v_effective,
    'precedence', jsonb_build_array('event', 'organizer', 'global'),
    'labels', jsonb_build_object(
      'service_fee', '808Tickets service fee',
      'processing_fee', 'Payment processing fee'
    ),
    'notes', 'Existing orders are not recalculated. Changes affect new orders only.'
  );
end;
$$;

revoke all on function public.admin_get_event_monetization(uuid) from public;
grant execute on function public.admin_get_event_monetization(uuid) to authenticated, service_role;
