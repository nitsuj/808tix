-- Fix: FOUND was read after set_config(), not after UPDATE, which could
-- mis-classify a failed atomic update as 'valid'.

create or replace function public.validate_pass(
  p_secure_token text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanned_by uuid;
  v_token text;
  v_pass public.passes%rowtype;
  v_event_organizer_id uuid;
  v_result text;
  v_updated_pass public.passes%rowtype;
  v_final_status text;
begin
  v_scanned_by := auth.uid();
  if v_scanned_by is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  v_token := btrim(coalesce(p_secure_token, ''));

  if v_token = '' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (null, p_event_id, v_scanned_by, 'invalid');

    return jsonb_build_object('result', 'invalid');
  end if;

  select *
  into v_pass
  from public.passes
  where secure_token = v_token;

  if not found then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (null, p_event_id, v_scanned_by, 'invalid');

    return jsonb_build_object('result', 'invalid');
  end if;

  select organizer_id
  into v_event_organizer_id
  from public.events
  where id = p_event_id;

  if not found or v_event_organizer_id is distinct from v_scanned_by then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'invalid');

    return jsonb_build_object(
      'result', 'invalid',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  if v_pass.event_id is distinct from p_event_id then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'wrong_event');

    return jsonb_build_object(
      'result', 'wrong_event',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  if v_pass.status = 'voided' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'voided');

    return jsonb_build_object(
      'result', 'voided',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  if v_pass.status = 'checked_in' then
    insert into public.checkins (pass_id, event_id, scanned_by, result)
    values (v_pass.id, p_event_id, v_scanned_by, 'already_used');

    return jsonb_build_object(
      'result', 'already_used',
      'pass_id', v_pass.id,
      'guest_name', v_pass.guest_name
    );
  end if;

  perform set_config('app.allow_pass_status_update', 'true', true);

  v_updated_pass := null;

  update public.passes
  set
    status = 'checked_in',
    checked_in_at = now(),
    checked_in_by = v_scanned_by,
    updated_at = now()
  where id = v_pass.id
    and status = 'active'
  returning *
  into v_updated_pass;

  perform set_config('app.allow_pass_status_update', 'false', true);

  if v_updated_pass.id is not null then
    v_result := 'valid';
  else
    select status
    into v_final_status
    from public.passes
    where id = v_pass.id;

    if v_final_status = 'checked_in' then
      v_result := 'already_used';
    elsif v_final_status = 'voided' then
      v_result := 'voided';
    else
      v_result := 'invalid';
    end if;
  end if;

  insert into public.checkins (pass_id, event_id, scanned_by, result)
  values (v_pass.id, p_event_id, v_scanned_by, v_result);

  return jsonb_build_object(
    'result', v_result,
    'pass_id', v_pass.id,
    'guest_name', v_pass.guest_name
  );
end;
$$;

revoke all on function public.validate_pass(text, uuid) from public;
grant execute on function public.validate_pass(text, uuid) to authenticated;
