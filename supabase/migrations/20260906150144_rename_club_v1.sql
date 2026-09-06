-- Owner-only club rename. Direct client updates to public.clubs remain blocked.

create function private.update_club_name(p_club_id uuid, p_name text)
returns table (
  club_id uuid,
  name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_club_status public.club_status;
begin
  perform private.require_authenticated_profile_id();

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if v_name = '' or pg_catalog.char_length(v_name) > 80 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.club_name_invalid';
  end if;

  if p_club_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.club_rename_forbidden';
  end if;

  select club.status
  into v_club_status
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club_status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.club_rename_forbidden';
  end if;

  if not private.is_club_owner(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.club_rename_forbidden';
  end if;

  update public.clubs as club
  set name = v_name
  where club.id = p_club_id
  returning club.id, club.name
  into club_id, name;

  return next;
end;
$function$;

comment on function private.update_club_name(uuid, text) is
  'Renames an active club. Current owner only. Validates and trims the name.';

create function public.update_club_name(p_club_id uuid, p_name text)
returns table (
  club_id uuid,
  name text
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.update_club_name(p_club_id, p_name);
$function$;

comment on function public.update_club_name(uuid, text) is
  'Public wrapper for owner-only club rename. Direct club updates remain blocked.';

revoke all on function private.update_club_name(uuid, text) from public, anon, authenticated;
grant execute on function private.update_club_name(uuid, text) to authenticated;

revoke all on function public.update_club_name(uuid, text) from public, anon;
grant execute on function public.update_club_name(uuid, text) to authenticated;
