-- 808Tix: self-service organizer profile backfill for authenticated users.
-- Complements handle_new_user trigger when signup race or legacy users lack a row.

create or replace function public.ensure_organizer_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_profile public.profiles;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if found then
    return v_profile;
  end if;

  select email
  into v_email
  from auth.users
  where id = v_user_id;

  insert into public.profiles (id, email)
  values (v_user_id, v_email)
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.ensure_organizer_profile() from public;
grant execute on function public.ensure_organizer_profile() to authenticated;
