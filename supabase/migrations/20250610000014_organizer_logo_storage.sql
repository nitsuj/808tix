-- Organizer profile logos: public read, organizer-scoped upload.
-- Path contract: {organizer_uuid}/logo.{jpg|png|webp}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organizer-logos',
  'organizer-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_organizer_logo_is_owned(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organizer_id uuid;
begin
  if object_name is null or object_name = '' then
    return false;
  end if;

  if object_name !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/logo\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  begin
    v_organizer_id := split_part(object_name, '/', 1)::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return v_organizer_id = (select auth.uid());
end;
$$;

revoke all on function public.storage_organizer_logo_is_owned(text) from public;
grant execute on function public.storage_organizer_logo_is_owned(text) to authenticated;

create policy organizer_logos_select_public
  on storage.objects
  for select
  to public
  using (bucket_id = 'organizer-logos');

create policy organizer_logos_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organizer-logos'
    and public.storage_organizer_logo_is_owned(name)
  );

create policy organizer_logos_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organizer-logos'
    and public.storage_organizer_logo_is_owned(name)
  )
  with check (
    bucket_id = 'organizer-logos'
    and public.storage_organizer_logo_is_owned(name)
  );

create policy organizer_logos_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organizer-logos'
    and public.storage_organizer_logo_is_owned(name)
  );
