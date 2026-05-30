-- Fix event-artwork storage RLS: ownership check via security definer helper.
--
-- Why: policies that subquery public.events from storage.objects can fail when
-- events RLS interacts with the policy check. Upsert also needs reliable INSERT,
-- SELECT, and UPDATE policies on the same path pattern.
--
-- Path contract: {event_uuid}/artwork.{jpg|png|webp}

create or replace function public.storage_event_artwork_is_owned(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  if object_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/artwork\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  begin
    v_event_id := split_part(object_name, '/', 1)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select 1
    from public.events e
    where e.id = v_event_id
      and e.organizer_id = (select auth.uid())
  );
end;
$$;

revoke all on function public.storage_event_artwork_is_owned(text) from public;
grant execute on function public.storage_event_artwork_is_owned(text) to authenticated;

drop policy if exists event_artwork_select_public on storage.objects;
drop policy if exists event_artwork_insert_own on storage.objects;
drop policy if exists event_artwork_update_own on storage.objects;
drop policy if exists event_artwork_delete_own on storage.objects;

create policy event_artwork_select_public
  on storage.objects
  for select
  to public
  using (bucket_id = 'event-artwork');

create policy event_artwork_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'event-artwork'
    and public.storage_event_artwork_is_owned(name)
  );

create policy event_artwork_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'event-artwork'
    and public.storage_event_artwork_is_owned(name)
  )
  with check (
    bucket_id = 'event-artwork'
    and public.storage_event_artwork_is_owned(name)
  );

create policy event_artwork_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'event-artwork'
    and public.storage_event_artwork_is_owned(name)
  );
