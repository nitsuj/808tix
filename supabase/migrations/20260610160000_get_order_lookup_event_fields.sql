-- Extend buyer order lookup with event display fields for inline post-purchase tickets.
create or replace function public.get_order_by_public_token(p_public_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_order public.orders%rowtype;
  v_event_name text;
  v_venue_name text;
  v_event_date date;
  v_start_time time;
  v_image_url text;
  v_ticket_count integer;
  v_tickets jsonb;
begin
  v_token := btrim(coalesce(p_public_access_token, ''));

  if v_token = '' then
    return null;
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.public_access_token = v_token;

  if not found then
    return null;
  end if;

  select
    e.name,
    e.venue_name,
    e.event_date,
    e.start_time,
    e.image_url
  into
    v_event_name,
    v_venue_name,
    v_event_date,
    v_start_time,
    v_image_url
  from public.events e
  where e.id = v_order.event_id;

  select coalesce(sum(oi.quantity), 0)::integer
  into v_ticket_count
  from public.order_items oi
  where oi.order_id = v_order.id;

  v_tickets := null;

  if v_order.status = 'paid' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'secure_token', p.secure_token,
          'pass_type', p.pass_type,
          'guest_name', p.guest_name
        )
        order by p.order_item_id, p.sequence
      ),
      '[]'::jsonb
    )
    into v_tickets
    from public.passes p
    where p.order_id = v_order.id
      and p.source = 'paid';
  end if;

  return jsonb_build_object(
    'status', v_order.status,
    'event_name', v_event_name,
    'venue_name', v_venue_name,
    'event_date', v_event_date,
    'start_time', v_start_time,
    'image_url', v_image_url,
    'ticket_count', v_ticket_count,
    'tickets', case when v_order.status = 'paid' then v_tickets else null end
  );
end;
$$;

revoke all on function public.get_order_by_public_token(text) from public;
grant execute on function public.get_order_by_public_token(text) to anon, authenticated;
