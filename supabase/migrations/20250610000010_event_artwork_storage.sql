-- Event artwork: Supabase Storage bucket + organizer-scoped upload policies.
-- Public read (bucket is public) so guest pass links can load artwork without auth.
-- Object path: {event_id}/artwork.{jpg|png|webp}
-- events.image_url stores the public URL after upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-artwork',
  'event-artwork',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );

create policy event_artwork_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'event-artwork'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event-artwork'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );

create policy event_artwork_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'event-artwork'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.organizer_id = auth.uid()
    )
  );
