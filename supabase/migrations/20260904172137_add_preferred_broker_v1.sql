-- Preferred broker V1: user-level setting. Private account data, not club roster data.

create type public.preferred_broker as enum (
  'nordnet',
  'dnb',
  'kron',
  'sparebank1',
  'other'
);

alter table public.profiles
  add column if not exists preferred_broker public.preferred_broker;

comment on column public.profiles.preferred_broker is
  'User-level preferred broker. Private account/settings data; not part of club roster identity.';

-- Identity columns stay club-readable. preferred_broker is excluded so fellow
-- members and outsiders cannot select or filter on it.
revoke select on public.profiles from authenticated;
grant select (
  id,
  display_name,
  avatar_path,
  created_at,
  updated_at
) on public.profiles to authenticated;

revoke update on public.profiles from authenticated;
grant update (
  display_name,
  avatar_path,
  preferred_broker
) on public.profiles to authenticated;

create function private.get_own_preferred_broker()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select profile.preferred_broker::text
  from public.profiles as profile
  where profile.id = (select auth.uid());
$function$;

create function public.get_own_preferred_broker()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_own_preferred_broker();
$function$;

revoke all on function private.get_own_preferred_broker() from public, anon, authenticated;
revoke all on function public.get_own_preferred_broker() from public, anon;

grant execute on function private.get_own_preferred_broker() to authenticated;
grant execute on function public.get_own_preferred_broker() to authenticated;
