-- Public upcoming events list for consumer homepage discovery (anon-safe).

create or replace function public.list_public_upcoming_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_events jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'venue_name', e.venue_name,
        'event_date', e.event_date,
        'start_time', e.start_time,
        'image_url', e.image_url,
        'currency', e.currency,
        'starting_price_cents', e.starting_price_cents
      )
      order by e.event_date asc nulls last, e.start_time asc nulls last, e.name asc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select
      ev.id,
      ev.name,
      ev.venue_name,
      ev.event_date,
      ev.start_time,
      ev.image_url,
      ev.currency,
      (
        select min(tt.price_cents)
        from public.ticket_types tt
        where tt.event_id = ev.id
          and tt.is_active = true
          and (tt.sales_start_at is null or tt.sales_start_at <= now())
          and (tt.sales_end_at is null or tt.sales_end_at >= now())
      ) as starting_price_cents
    from public.events ev
    where ev.status = 'published'
      and ev.sales_enabled = true
      and ev.ticketing_mode in ('paid', 'mixed')
      and (ev.event_date is null or ev.event_date >= (timezone('utc', now()))::date)
  ) e
  where e.starting_price_cents is not null;

  return v_events;
end;
$$;

revoke all on function public.list_public_upcoming_events() from public;
grant execute on function public.list_public_upcoming_events() to anon, authenticated;
