-- 808Tix Phase 1.5: public buyer purchase options (read-only RPC for purchase page).

-- ---------------------------------------------------------------------------
-- get_public_event_purchase_options: anon-safe event + ticket type display data
-- ---------------------------------------------------------------------------
create or replace function public.get_public_event_purchase_options(p_event_id uuid)
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
  v_ticket_types jsonb;
begin
  select *
  into v_event
  from public.events
  where id = p_event_id;

  if not found then
    return null;
  end if;

  if v_event.status <> 'published' then
    return null;
  end if;

  if not v_event.sales_enabled then
    return null;
  end if;

  if v_event.ticketing_mode not in ('paid', 'mixed') then
    return null;
  end if;

  v_event_issued := public.event_issued_pass_count(p_event_id);
  v_event_reserved := public.event_reserved_pass_count(p_event_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'name', x.name,
        'description', x.description,
        'price_cents', x.price_cents,
        'currency', x.currency,
        'capacity', x.capacity,
        'quantity_available', x.quantity_available,
        'sales_start_at', x.sales_start_at,
        'sales_end_at', x.sales_end_at,
        'sort_order', x.sort_order
      )
      order by x.sort_order asc, x.created_at asc
    ),
    '[]'::jsonb
  )
  into v_ticket_types
  from (
    select
      tt.id,
      tt.name,
      tt.description,
      tt.price_cents,
      tt.currency,
      tt.capacity,
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
      end as quantity_available,
      tt.sales_start_at,
      tt.sales_end_at,
      tt.sort_order,
      tt.created_at
    from public.ticket_types tt
    where tt.event_id = p_event_id
      and tt.is_active = true
      and (tt.sales_start_at is null or tt.sales_start_at <= now())
      and (tt.sales_end_at is null or tt.sales_end_at >= now())
  ) x;

  return jsonb_build_object(
    'event',
    jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'venue_name', v_event.venue_name,
      'event_date', v_event.event_date,
      'start_time', v_event.start_time,
      'description', v_event.description,
      'image_url', v_event.image_url,
      'currency', v_event.currency,
      'capacity', v_event.capacity,
      'ticketing_mode', v_event.ticketing_mode,
      'sales_enabled', v_event.sales_enabled,
      'platform_fee_bps', v_event.platform_fee_bps,
      'platform_fee_fixed_cents', v_event.platform_fee_fixed_cents
    ),
    'ticket_types', v_ticket_types
  );
end;
$$;

revoke all on function public.get_public_event_purchase_options(uuid) from public;
grant execute on function public.get_public_event_purchase_options(uuid) to anon, authenticated;
