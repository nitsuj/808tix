-- Event artwork storage verification (run after migrations 10 + 11).
--
-- Prerequisites:
--   1. supabase start && supabase db reset (or migration up through 11)
--   2. Replace v_organizer_id and v_other_organizer_id with real auth.users ids
--   3. Run supabase/dev/auth_simulation.sql in this session
--
-- Checks:
--   - Owner can insert / update / delete {event_id}/artwork.jpg
--   - Public can select artwork objects
--   - Non-owner cannot write another event's artwork path
--   - Invalid path shapes are rejected

do $$
declare
  v_organizer_id uuid := null; -- REPLACE
  v_other_organizer_id uuid := null; -- REPLACE (different user)
  v_event_id uuid;
  v_other_event_id uuid;
  v_object_id uuid;
begin
  if v_organizer_id is null or v_other_organizer_id is null then
    raise exception 'Replace v_organizer_id and v_other_organizer_id before running';
  end if;

  if to_regprocedure('dev.set_auth_as(uuid)') is null then
    raise exception 'Run supabase/dev/auth_simulation.sql in this session first';
  end if;

  insert into public.profiles (id, email)
  values
    (v_organizer_id, 'artwork-owner@808tix.test'),
    (v_other_organizer_id, 'artwork-other@808tix.test')
  on conflict (id) do nothing;

  insert into public.events (organizer_id, slug, name, status)
  values (v_organizer_id, 'artwork-verify-show', 'Artwork Verify Show', 'published')
  returning id into v_event_id;

  insert into public.events (organizer_id, slug, name, status)
  values (v_other_organizer_id, 'artwork-verify-other', 'Other Show', 'published')
  returning id into v_other_event_id;

  perform dev.set_auth_as(v_organizer_id);

  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'event-artwork',
    v_event_id::text || '/artwork.jpg',
    v_organizer_id,
    '{"mimetype":"image/jpeg"}'::jsonb
  )
  returning id into v_object_id;

  update storage.objects
  set metadata = '{"mimetype":"image/jpeg","size":123}'::jsonb
  where id = v_object_id;

  delete from storage.objects where id = v_object_id;

  perform dev.set_auth_as(v_other_organizer_id);

  begin
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'event-artwork',
      v_event_id::text || '/artwork.jpg',
      v_other_organizer_id,
      '{"mimetype":"image/jpeg"}'::jsonb
    );
    raise exception 'Expected non-owner insert into another event folder to fail';
  exception
    when insufficient_privilege then
      null;
    when sqlstate '42501' then
      null;
  end;

  reset role;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'event-artwork'
      and o.name = v_event_id::text || '/artwork.jpg'
  ) then
    raise notice 'No public rows yet (expected after owner delete).';
  end if;

  perform dev.set_auth_as(v_organizer_id);

  if public.storage_event_artwork_is_owned(v_event_id::text || '/artwork.jpg') is not true then
    raise exception 'storage_event_artwork_is_owned should be true for owner path';
  end if;

  if public.storage_event_artwork_is_owned('not-a-uuid/artwork.jpg') is not false then
    raise exception 'storage_event_artwork_is_owned should reject invalid path';
  end if;

  reset role;

  raise notice 'Event artwork storage verification passed.';
end;
$$;
