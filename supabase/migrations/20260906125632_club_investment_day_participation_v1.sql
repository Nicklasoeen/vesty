-- Club-scoped Investment Day participation and streaks.
-- Completion is derived from member_cycle_participations.outcome = 'confirmed'.
-- The public RPC returns only social fields — never amounts, quantities, or prices.

create function private.member_completed_investment_cycle_v1(
  p_membership_id uuid,
  p_cycle_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.member_cycle_participations as participation
    where participation.membership_id = p_membership_id
      and participation.investment_cycle_id = p_cycle_id
      and participation.outcome = 'confirmed'
  );
$function$;

create function private.member_investment_day_streak_v1(
  p_club_id uuid,
  p_membership_id uuid,
  p_now timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_streak integer := 0;
  v_row record;
begin
  for v_row in
    select
      cycle.id,
      cycle.status,
      cycle.reporting_closes_at,
      private.member_completed_investment_cycle_v1(p_membership_id, cycle.id) as completed
    from public.investment_cycles as cycle
    join public.club_memberships as membership
      on membership.id = p_membership_id
     and membership.club_id = cycle.club_id
    where cycle.club_id = p_club_id
      and cycle.status not in ('upcoming', 'cancelled')
      and cycle.investment_day_at <= p_now
      and cycle.investment_day_at >= membership.joined_at
      and (membership.ended_at is null or cycle.investment_day_at < membership.ended_at)
    order by cycle.investment_day_at desc, cycle.id desc
  loop
    if v_row.completed then
      v_streak := v_streak + 1;
    elsif v_row.status = 'open' and v_row.reporting_closes_at >= p_now then
      continue;
    else
      exit;
    end if;
  end loop;

  return v_streak;
end;
$function$;

create function private.club_investment_day_participation_v1(
  p_club_id uuid,
  p_cycle_id uuid
)
returns table (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_path text,
  cycle_id uuid,
  completed boolean,
  completed_at timestamptz,
  verification_level text,
  current_streak integer,
  member_count integer,
  completed_count integer,
  pending_count integer,
  all_completed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_cycle public.investment_cycles%rowtype;
  v_member_count integer;
  v_completed_count integer;
begin
  if p_club_id is null or p_cycle_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  if not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_cycle
  from public.investment_cycles as cycle
  where cycle.id = p_cycle_id
    and cycle.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.cycle_invalid';
  end if;

  select pg_catalog.count(*)
  into v_member_count
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.status = 'active';

  select pg_catalog.count(*)
  into v_completed_count
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.status = 'active'
    and private.member_completed_investment_cycle_v1(membership.id, p_cycle_id);

  return query
  select
    membership.id,
    membership.profile_id,
    profile.display_name,
    profile.avatar_path,
    v_cycle.id,
    private.member_completed_investment_cycle_v1(membership.id, p_cycle_id),
    participation.reported_at,
    case
      when participation.outcome = 'confirmed' then 'member_reported'
      else null
    end,
    private.member_investment_day_streak_v1(p_club_id, membership.id),
    v_member_count,
    v_completed_count,
    v_member_count - v_completed_count,
    v_member_count > 0 and v_completed_count = v_member_count
  from public.club_memberships as membership
  join public.profiles as profile
    on profile.id = membership.profile_id
  left join public.member_cycle_participations as participation
    on participation.membership_id = membership.id
   and participation.investment_cycle_id = p_cycle_id
   and participation.club_id = p_club_id
  where membership.club_id = p_club_id
    and membership.status = 'active'
  order by
    case
      when membership.id = (
        select club.current_owner_membership_id
        from public.clubs as club
        where club.id = p_club_id
      ) then 0
      else 1
    end,
    membership.joined_at,
    membership.id;
end;
$function$;

create function public.club_investment_day_participation_v1(
  p_club_id uuid,
  p_cycle_id uuid
)
returns table (
  membership_id uuid,
  profile_id uuid,
  display_name text,
  avatar_path text,
  cycle_id uuid,
  completed boolean,
  completed_at timestamptz,
  verification_level text,
  current_streak integer,
  member_count integer,
  completed_count integer,
  pending_count integer,
  all_completed boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.club_investment_day_participation_v1(p_club_id, p_cycle_id);
$function$;

comment on function public.club_investment_day_participation_v1(uuid, uuid) is
  'Club-member social read of Investment Day completion and per-club streaks. Does not expose transaction amounts, quantities, or prices.';

revoke all on function private.member_completed_investment_cycle_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.member_investment_day_streak_v1(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.club_investment_day_participation_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.club_investment_day_participation_v1(uuid, uuid) from public, anon;

grant execute on function private.club_investment_day_participation_v1(uuid, uuid) to authenticated;
grant execute on function public.club_investment_day_participation_v1(uuid, uuid) to authenticated;
