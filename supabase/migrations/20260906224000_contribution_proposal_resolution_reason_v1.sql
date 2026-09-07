-- Explicit contribution-proposal resolution reason.
-- Distinguishes stale_base from a failed vote without changing status values.

create type public.contribution_proposal_resolution_reason as enum (
  'vote_approved',
  'vote_rejected',
  'stale_base',
  'expired',
  'cancelled'
);

alter table public.contribution_policy_proposals
  add column resolution_reason public.contribution_proposal_resolution_reason;

update public.contribution_policy_proposals
set resolution_reason = case status
  when 'approved' then 'vote_approved'::public.contribution_proposal_resolution_reason
  when 'rejected' then 'vote_rejected'::public.contribution_proposal_resolution_reason
  when 'expired' then 'expired'::public.contribution_proposal_resolution_reason
  when 'cancelled' then 'cancelled'::public.contribution_proposal_resolution_reason
  else null
end
where status in ('approved', 'rejected', 'expired', 'cancelled')
  and resolution_reason is null;

alter table public.contribution_policy_proposals
  add constraint contribution_policy_proposals_resolution_reason_check
  check (
    (
      status in ('draft', 'open')
      and resolution_reason is null
    )
    or
    (
      status = 'approved'
      and resolution_reason = 'vote_approved'
    )
    or
    (
      status = 'rejected'
      and resolution_reason in ('vote_rejected', 'stale_base')
    )
    or
    (
      status = 'expired'
      and resolution_reason = 'expired'
    )
    or
    (
      status = 'cancelled'
      and resolution_reason = 'cancelled'
    )
  );

comment on column public.contribution_policy_proposals.resolution_reason is
  'Authoritative terminal reason. Clients must not infer stale_base from vote tallies.';

-- ---------------------------------------------------------------------------
-- Cancel / finalize write the reason
-- ---------------------------------------------------------------------------

create or replace function private.cancel_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_proposal public.contribution_policy_proposals%rowtype;
  v_votes integer;
begin
  v_user_id := private.require_authenticated_profile_id();

  select *
  into v_proposal
  from public.contribution_policy_proposals as proposal
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if not exists (
    select 1
    from public.club_memberships as membership
    where membership.id = v_proposal.proposer_membership_id
      and membership.profile_id = v_user_id
      and membership.status = 'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_forbidden';
  end if;

  if v_proposal.status not in ('draft', 'open') then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if v_proposal.status = 'open' then
    select count(*)
    into v_votes
    from public.votes as vote
    where vote.proposal_id = v_proposal.id;

    if v_votes > 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_proposal_has_votes';
    end if;
  end if;

  update public.contribution_policy_proposals as proposal
  set status = 'cancelled',
      resolution_reason = 'cancelled',
      closed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where proposal.id = v_proposal.id;

  return query
  select v_proposal.id, 'cancelled'::public.strategy_proposal_status;
end;
$function$;

create or replace function private.finalize_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status,
  policy_version_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_proposal public.contribution_policy_proposals%rowtype;
  v_yes integer;
  v_cast integer;
  v_remaining integer;
  v_policy_id uuid;
  v_now timestamptz;
  v_next_status public.strategy_proposal_status;
  v_reason public.contribution_proposal_resolution_reason;
begin
  v_user_id := private.require_authenticated_profile_id();

  select *
  into v_proposal
  from public.contribution_policy_proposals as proposal
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if not private.is_active_club_member(v_proposal.club_id)
    and not exists (
      select 1
      from public.proposal_electorate_members as electorate
      join public.club_memberships as membership
        on membership.id = electorate.membership_id
      where electorate.proposal_id = v_proposal.id
        and membership.profile_id = v_user_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_proposal.club_id::text || ':contribution-governance', 0)
  );

  if v_proposal.status = 'approved' then
    select policy.id
    into v_policy_id
    from public.contribution_policy_versions as policy
    where policy.source_proposal_id = v_proposal.id;

    return query
    select v_proposal.id, v_proposal.status, v_policy_id;
    return;
  end if;

  if v_proposal.status in ('rejected', 'expired', 'cancelled') then
    return query
    select v_proposal.id, v_proposal.status, null::uuid;
    return;
  end if;

  if v_proposal.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_not_open';
  end if;

  select
    count(*) filter (where vote.choice = 'yes'),
    count(*)
  into v_yes, v_cast
  from public.votes as vote
  where vote.proposal_id = v_proposal.id;

  v_remaining := v_proposal.electorate_size - v_cast;
  v_now := pg_catalog.now();

  if v_yes >= v_proposal.required_yes_count then
    v_next_status := 'approved';
    v_reason := 'vote_approved';
  elsif v_remaining < (v_proposal.required_yes_count - v_yes) then
    v_next_status := 'rejected';
    v_reason := 'vote_rejected';
  elsif v_now >= v_proposal.deadline_at then
    v_next_status := 'expired';
    v_reason := 'expired';
  else
    return query
    select v_proposal.id, v_proposal.status, null::uuid;
    return;
  end if;

  if v_next_status = 'approved' then
    begin
      v_policy_id := private.apply_approved_contribution_policy_proposal_v1(v_proposal);
    exception
      when others then
        if sqlerrm = 'vesty.contribution_proposal_stale' then
          update public.contribution_policy_proposals as proposal
          set status = 'rejected',
              resolution_reason = 'stale_base',
              closed_at = v_now,
              updated_at = v_now
          where proposal.id = v_proposal.id;

          return query
          select v_proposal.id, 'rejected'::public.strategy_proposal_status, null::uuid;
          return;
        end if;
        raise;
    end;

    update public.contribution_policy_proposals as proposal
    set status = 'approved',
        resolution_reason = 'vote_approved',
        closed_at = v_now,
        approved_at = v_now,
        updated_at = v_now
    where proposal.id = v_proposal.id;

    return query
    select v_proposal.id, 'approved'::public.strategy_proposal_status, v_policy_id;
    return;
  end if;

  update public.contribution_policy_proposals as proposal
  set status = v_next_status,
      resolution_reason = v_reason,
      closed_at = v_now,
      updated_at = v_now
  where proposal.id = v_proposal.id;

  return query
  select v_proposal.id, v_next_status, null::uuid;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Read model exposes the authoritative reason
-- ---------------------------------------------------------------------------

drop function if exists public.club_contribution_policy_proposals_v1(uuid);
drop function if exists private.club_contribution_policy_proposals_v1(uuid);

create function private.club_contribution_policy_proposals_v1(p_club_id uuid)
returns table (
  proposal_id uuid,
  club_id uuid,
  proposer_membership_id uuid,
  status public.strategy_proposal_status,
  resolution_reason public.contribution_proposal_resolution_reason,
  deadline_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  approved_at timestamptz,
  electorate_size integer,
  required_yes_count integer,
  voting_threshold_kind public.governance_threshold_kind,
  base_contribution_policy_version_id uuid,
  base_mode public.contribution_policy_mode,
  base_equal_amount_minor bigint,
  proposed_mode public.contribution_policy_mode,
  proposed_equal_amount_minor bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_club_id is null or not private.is_active_club_member(p_club_id) then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  return query
  select
    proposal.id,
    proposal.club_id,
    proposal.proposer_membership_id,
    proposal.status,
    proposal.resolution_reason,
    proposal.deadline_at,
    proposal.opened_at,
    proposal.closed_at,
    proposal.approved_at,
    proposal.electorate_size,
    proposal.required_yes_count,
    proposal.voting_threshold_kind,
    proposal.base_contribution_policy_version_id,
    base.mode,
    base.equal_amount_minor,
    proposal.proposed_mode,
    proposal.proposed_equal_amount_minor
  from public.contribution_policy_proposals as proposal
  join public.contribution_policy_versions as base
    on base.id = proposal.base_contribution_policy_version_id
  where proposal.club_id = p_club_id
    and private.can_access_proposal(proposal.id)
  order by proposal.created_at desc;
end;
$function$;

create function public.club_contribution_policy_proposals_v1(p_club_id uuid)
returns table (
  proposal_id uuid,
  club_id uuid,
  proposer_membership_id uuid,
  status public.strategy_proposal_status,
  resolution_reason public.contribution_proposal_resolution_reason,
  deadline_at timestamptz,
  opened_at timestamptz,
  closed_at timestamptz,
  approved_at timestamptz,
  electorate_size integer,
  required_yes_count integer,
  voting_threshold_kind public.governance_threshold_kind,
  base_contribution_policy_version_id uuid,
  base_mode public.contribution_policy_mode,
  base_equal_amount_minor bigint,
  proposed_mode public.contribution_policy_mode,
  proposed_equal_amount_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.club_contribution_policy_proposals_v1(p_club_id);
$function$;

comment on function public.finalize_contribution_policy_proposal_v1(uuid) is
  'Tallies an open contribution proposal. Writes resolution_reason. Approval creates one ContributionPolicyVersion. Stale bases close as rejected/stale_base without a new version.';

comment on function public.club_contribution_policy_proposals_v1(uuid) is
  'Club-readable contribution proposal list including resolution_reason. Base/proposed styles and shared Equal amounts only. Never returns private Flexible commitments.';

revoke all on function private.club_contribution_policy_proposals_v1(uuid) from public, anon, authenticated;
revoke all on function public.club_contribution_policy_proposals_v1(uuid) from public, anon;

grant execute on function private.club_contribution_policy_proposals_v1(uuid) to authenticated;
grant execute on function public.club_contribution_policy_proposals_v1(uuid) to authenticated;
