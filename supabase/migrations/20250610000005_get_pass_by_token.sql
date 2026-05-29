-- 808Tix MVP: public guest pass view (no auth required)

create or replace function public.get_pass_by_token(p_secure_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_row record;
begin
  v_token := btrim(coalesce(p_secure_token, ''));

  if v_token = '' then
    return null;
  end if;

  select
    p.guest_name,
    p.pass_type,
    p.status,
    p.secure_token,
    e.name as event_name,
    e.slug as event_slug,
    e.venue_name,
    e.event_date,
    e.start_time,
    e.description,
    e.image_url
  into v_row
  from public.passes p
  inner join public.events e on e.id = p.event_id
  where p.secure_token = v_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'guest_name', v_row.guest_name,
    'pass_type', v_row.pass_type,
    'status', v_row.status,
    'secure_token', v_row.secure_token,
    'event_name', v_row.event_name,
    'event_slug', v_row.event_slug,
    'venue_name', v_row.venue_name,
    'event_date', v_row.event_date,
    'start_time', v_row.start_time,
    'description', v_row.description,
    'image_url', v_row.image_url
  );
end;
$$;

revoke all on function public.get_pass_by_token(text) from public;
grant execute on function public.get_pass_by_token(text) to anon, authenticated;
