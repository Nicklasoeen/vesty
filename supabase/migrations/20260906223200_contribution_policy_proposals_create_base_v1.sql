-- Drafts may target a historical base version. Stale-base is enforced at
-- open and apply. Remove the ambiguous 3-argument append overload.

drop function if exists private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
);

create or replace function private.create_contribution_policy_proposal_v1(
  p_club_id uuid,
  p_base_contribution_policy_version_id uuid,
  p_proposed_mode public.contribution_policy_mode,
  p_proposed_equal_amount_minor bigint
)
returns table (
  proposal_id uuid,
  club_id uuid,
  status public.strategy_proposal_status,
  base_contribution_policy_version_id uuid,
  proposed_mode public.contribution_policy_mode,
  proposed_equal_amount_minor bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_membership public.club_memberships%rowtype;
  v_base public.contribution_policy_versions%rowtype;
  v_id uuid;
begin
  v_user_id := private.require_authenticated_profile_id();

  select *
  into v_membership
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.profile_id = v_user_id
    and membership.status = 'active';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.not_club_member';
  end if;

  select *
  into v_base
  from public.contribution_policy_versions as policy
  where policy.id = p_base_contribution_policy_version_id
    and policy.club_id = p_club_id;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  perform private.validate_contribution_policy_change_v1(
    v_base,
    p_proposed_mode,
    p_proposed_equal_amount_minor
  );

  insert into public.contribution_policy_proposals (
    club_id,
    proposer_membership_id,
    base_contribution_policy_version_id,
    proposed_mode,
    proposed_equal_amount_minor,
    status
  )
  values (
    p_club_id,
    v_membership.id,
    v_base.id,
    p_proposed_mode,
    case
      when p_proposed_mode = 'equal' then p_proposed_equal_amount_minor
      else null
    end,
    'draft'
  )
  returning public.contribution_policy_proposals.id into v_id;

  return query
  select
    proposal.id,
    proposal.club_id,
    proposal.status,
    proposal.base_contribution_policy_version_id,
    proposal.proposed_mode,
    proposal.proposed_equal_amount_minor
  from public.contribution_policy_proposals as proposal
  where proposal.id = v_id;
end;
$function$;
