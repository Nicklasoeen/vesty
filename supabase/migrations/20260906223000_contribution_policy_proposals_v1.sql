-- Contribution Policy Proposals V1.
-- Thin shared club_proposals identity so electorate/votes stay one path.
-- Strategy proposal rows and mobile reads are unchanged.
-- Policy versions are created only by trusted approved application.

-- ---------------------------------------------------------------------------
-- Shared identity
-- ---------------------------------------------------------------------------

create type public.club_proposal_kind as enum (
  'strategy',
  'contribution_policy'
);

create table public.club_proposals (
  id uuid primary key,
  club_id uuid not null references public.clubs (id) on delete restrict,
  kind public.club_proposal_kind not null,
  created_at timestamptz not null default now(),

  constraint club_proposals_club_id_id_key
    unique (club_id, id)
);

comment on table public.club_proposals is
  'Shared proposal identity for electorate and votes. Strategy and contribution payloads stay type-specific.';

insert into public.club_proposals (id, club_id, kind, created_at)
select proposal.id, proposal.club_id, 'strategy', proposal.created_at
from public.strategy_proposals as proposal;

alter table public.strategy_proposals
  add constraint strategy_proposals_identity_fkey
  foreign key (id)
  references public.club_proposals (id)
  on delete restrict;

alter table public.proposal_electorate_members
  drop constraint proposal_electorate_members_proposal_same_club_fkey;

alter table public.proposal_electorate_members
  add constraint proposal_electorate_members_proposal_same_club_fkey
  foreign key (club_id, proposal_id)
  references public.club_proposals (club_id, id)
  on delete restrict;

create function private.ensure_club_proposal_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
begin
  insert into public.club_proposals (id, club_id, kind)
  values (
    new.id,
    new.club_id,
    case tg_table_name
      when 'strategy_proposals' then 'strategy'::public.club_proposal_kind
      else 'contribution_policy'::public.club_proposal_kind
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

create trigger strategy_proposals_identity_trg
before insert on public.strategy_proposals
for each row
execute function private.ensure_club_proposal_identity();

-- ---------------------------------------------------------------------------
-- Contribution payload
-- ---------------------------------------------------------------------------

create table public.contribution_policy_proposals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  proposer_membership_id uuid not null,
  base_contribution_policy_version_id uuid not null,
  proposed_mode public.contribution_policy_mode not null,
  proposed_equal_amount_minor bigint,
  status public.strategy_proposal_status not null default 'draft',
  voting_threshold_kind public.governance_threshold_kind,
  electorate_size integer,
  required_yes_count integer,
  intended_effective_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  deadline_at timestamptz,
  closed_at timestamptz,
  approved_at timestamptz,

  constraint contribution_policy_proposals_club_id_id_key
    unique (club_id, id),
  constraint contribution_policy_proposals_identity_fkey
    foreign key (id)
    references public.club_proposals (id)
    on delete restrict,
  constraint contribution_policy_proposals_proposer_same_club_fkey
    foreign key (club_id, proposer_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint contribution_policy_proposals_base_same_club_fkey
    foreign key (club_id, base_contribution_policy_version_id)
    references public.contribution_policy_versions (club_id, id)
    on delete restrict,
  constraint contribution_policy_proposals_updated_at_check
    check (updated_at >= created_at),
  constraint contribution_policy_proposals_proposed_amount_check
    check (
      (
        proposed_mode = 'equal'
        and proposed_equal_amount_minor is not null
        and proposed_equal_amount_minor > 0
      )
      or
      (
        proposed_mode = 'flexible'
        and proposed_equal_amount_minor is null
      )
    ),
  constraint contribution_policy_proposals_open_snapshot_check
    check (
      (
        opened_at is null
        and voting_threshold_kind is null
        and electorate_size is null
        and required_yes_count is null
        and intended_effective_at is null
        and deadline_at is null
      )
      or
      (
        opened_at is not null
        and voting_threshold_kind is not null
        and electorate_size is not null
        and required_yes_count is not null
        and intended_effective_at is not null
        and deadline_at is not null
      )
    ),
  constraint contribution_policy_proposals_threshold_check
    check (
      (
        voting_threshold_kind is null
        and electorate_size is null
        and required_yes_count is null
      )
      or
      (
        electorate_size > 0
        and required_yes_count = case voting_threshold_kind
          when 'simple_majority' then (electorate_size / 2) + 1
          when 'supermajority' then ((3 * electorate_size) + 3) / 4
          when 'unanimous' then electorate_size
        end
      )
    ),
  constraint contribution_policy_proposals_deadline_check
    check (deadline_at is null or deadline_at > opened_at),
  constraint contribution_policy_proposals_closed_at_check
    check (closed_at is null or closed_at >= coalesce(opened_at, created_at)),
  constraint contribution_policy_proposals_approved_at_check
    check (
      approved_at is null
      or (
        opened_at is not null
        and closed_at is not null
        and approved_at >= opened_at
        and approved_at <= closed_at
      )
    ),
  constraint contribution_policy_proposals_lifecycle_check
    check (
      (
        status = 'draft'
        and opened_at is null
        and closed_at is null
        and approved_at is null
      )
      or
      (
        status = 'open'
        and opened_at is not null
        and closed_at is null
        and approved_at is null
      )
      or
      (
        status = 'approved'
        and opened_at is not null
        and closed_at is not null
        and approved_at is not null
      )
      or
      (
        status in ('rejected', 'expired')
        and opened_at is not null
        and closed_at is not null
        and approved_at is null
      )
      or
      (
        status = 'cancelled'
        and closed_at is not null
        and approved_at is null
      )
    )
);

create unique index contribution_policy_proposals_one_open_per_club_idx
  on public.contribution_policy_proposals (club_id)
  where status = 'open';

create index contribution_policy_proposals_club_status_idx
  on public.contribution_policy_proposals (club_id, status, created_at desc);

comment on table public.contribution_policy_proposals is
  'Immutable contribution-policy change payload. Shared governance identity lives on club_proposals. Approval creates exactly one ContributionPolicyVersion.';

create trigger contribution_policy_proposals_identity_trg
before insert on public.contribution_policy_proposals
for each row
execute function private.ensure_club_proposal_identity();

alter table public.contribution_policy_versions
  add constraint contribution_policy_versions_source_proposal_fkey
  foreign key (source_proposal_id)
  references public.contribution_policy_proposals (id)
  on delete restrict;

create unique index contribution_policy_versions_source_proposal_key
  on public.contribution_policy_versions (source_proposal_id)
  where source_proposal_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.club_proposals enable row level security;
alter table public.club_proposals force row level security;
alter table public.contribution_policy_proposals enable row level security;
alter table public.contribution_policy_proposals force row level security;

revoke all on public.club_proposals from public, anon, authenticated;
revoke all on public.contribution_policy_proposals from public, anon, authenticated;

grant select on public.club_proposals to authenticated;
grant select on public.contribution_policy_proposals to authenticated;

-- ---------------------------------------------------------------------------
-- Generalized proposal access (strategy + contribution)
-- ---------------------------------------------------------------------------

create function private.club_proposal_governance(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  club_id uuid,
  kind public.club_proposal_kind,
  status public.strategy_proposal_status,
  deadline_at timestamptz,
  proposer_membership_id uuid
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    proposal.id,
    proposal.club_id,
    'strategy'::public.club_proposal_kind,
    proposal.status,
    proposal.deadline_at,
    proposal.proposer_membership_id
  from public.strategy_proposals as proposal
  where proposal.id = p_proposal_id
  union all
  select
    proposal.id,
    proposal.club_id,
    'contribution_policy'::public.club_proposal_kind,
    proposal.status,
    proposal.deadline_at,
    proposal.proposer_membership_id
  from public.contribution_policy_proposals as proposal
  where proposal.id = p_proposal_id;
$function$;

create or replace function private.can_access_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.club_proposal_governance(p_proposal_id) as proposal
    where exists (
      select 1
      from public.club_memberships as membership
      where membership.club_id = proposal.club_id
        and membership.profile_id = (select auth.uid())
        and membership.status = 'active'
    )
    or (
      proposal.status = 'open'
      and exists (
        select 1
        from public.proposal_electorate_members as electorate
        join public.club_memberships as membership
          on membership.id = electorate.membership_id
        where electorate.proposal_id = proposal.proposal_id
          and membership.profile_id = (select auth.uid())
      )
    )
  );
$function$;

create or replace function private.can_cast_vote(
  p_proposal_id uuid,
  p_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.club_proposal_governance(p_proposal_id) as proposal
    join public.proposal_electorate_members as electorate
      on electorate.proposal_id = proposal.proposal_id
     and electorate.membership_id = p_membership_id
    join public.club_memberships as membership
      on membership.id = electorate.membership_id
    where proposal.status = 'open'
      and proposal.deadline_at > now()
      and membership.profile_id = (select auth.uid())
  );
$function$;

drop policy if exists votes_select_terminal_active_members on public.votes;

create policy votes_select_terminal_active_members
on public.votes
for select
to authenticated
using (
  exists (
    select 1
    from public.strategy_proposals as proposal
    where proposal.id = proposal_id
      and proposal.status in ('approved', 'rejected', 'expired', 'cancelled')
      and (select private.is_active_club_member(proposal.club_id))
  )
  or exists (
    select 1
    from public.contribution_policy_proposals as proposal
    where proposal.id = proposal_id
      and proposal.status in ('approved', 'rejected', 'expired', 'cancelled')
      and (select private.is_active_club_member(proposal.club_id))
  )
);

create policy club_proposals_select_authorized
on public.club_proposals
for select
to authenticated
using ((select private.can_access_proposal(id)));

create policy contribution_policy_proposals_select_authorized
on public.contribution_policy_proposals
for select
to authenticated
using ((select private.can_access_proposal(id)));

-- ---------------------------------------------------------------------------
-- Trusted policy append: optional source proposal
-- ---------------------------------------------------------------------------

revoke all on function private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
) from public, anon, authenticated, service_role;

drop function private.create_contribution_policy_version_v1(
  uuid,
  public.contribution_policy_mode,
  bigint
);

create function private.create_contribution_policy_version_v1(
  p_club_id uuid,
  p_mode public.contribution_policy_mode,
  p_equal_amount_minor bigint,
  p_source_proposal_id uuid default null,
  p_created_by_membership_id uuid default null
)
returns table (
  policy_version_id uuid,
  version_number integer,
  mode public.contribution_policy_mode,
  currency text,
  equal_amount_minor bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_club public.clubs%rowtype;
  v_next integer;
  v_amount bigint;
  v_creator uuid;
begin
  if p_club_id is null or p_mode is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_invalid';
  end if;

  select *
  into v_club
  from public.clubs as club
  where club.id = p_club_id;

  if not found or v_club.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_forbidden';
  end if;

  v_creator := coalesce(p_created_by_membership_id, v_club.current_owner_membership_id);
  if v_creator is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_forbidden';
  end if;

  if p_source_proposal_id is not null
    and not exists (
      select 1
      from public.contribution_policy_proposals as proposal
      where proposal.id = p_source_proposal_id
        and proposal.club_id = p_club_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_policy_invalid';
  end if;

  if p_mode = 'equal' then
    v_amount := p_equal_amount_minor;
    if v_amount is null or v_amount <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
  else
    if p_equal_amount_minor is not null then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_policy_invalid';
    end if;
    v_amount := null;
  end if;

  select coalesce(max(policy.version_number), 0) + 1
  into v_next
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id;

  insert into public.contribution_policy_versions (
    club_id,
    version_number,
    mode,
    currency,
    equal_amount_minor,
    created_by_membership_id,
    source_proposal_id
  )
  values (
    p_club_id,
    v_next,
    p_mode,
    v_club.base_currency,
    v_amount,
    v_creator,
    p_source_proposal_id
  )
  returning
    public.contribution_policy_versions.id,
    public.contribution_policy_versions.version_number,
    public.contribution_policy_versions.mode,
    public.contribution_policy_versions.currency,
    public.contribution_policy_versions.equal_amount_minor
  into
    policy_version_id,
    version_number,
    mode,
    currency,
    equal_amount_minor;

  return next;
end;
$function$;

comment on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint, uuid, uuid) is
  'Trusted append of an immutable ContributionPolicyVersion. Not executable by authenticated clients. Approved contribution proposals call this after a vote. Creating a version activates it only for the next eligible/unfrozen Investment Cycle.';

-- ---------------------------------------------------------------------------
-- Governance helpers
-- ---------------------------------------------------------------------------

create function private.required_yes_count_v1(
  p_kind public.governance_threshold_kind,
  p_electorate_size integer
)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case p_kind
    when 'simple_majority' then (p_electorate_size / 2) + 1
    when 'supermajority' then ((3 * p_electorate_size) + 3) / 4
    when 'unanimous' then p_electorate_size
  end;
$function$;

create function private.latest_contribution_policy_row_v1(p_club_id uuid)
returns public.contribution_policy_versions
language sql
stable
security definer
set search_path = ''
as $function$
  select policy.*
  from public.contribution_policy_versions as policy
  where policy.club_id = p_club_id
  order by policy.version_number desc
  limit 1;
$function$;

create function private.validate_contribution_policy_change_v1(
  p_base public.contribution_policy_versions,
  p_proposed_mode public.contribution_policy_mode,
  p_proposed_equal_amount_minor bigint
)
returns void
language plpgsql
stable
set search_path = ''
as $function$
begin
  if p_base.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if p_proposed_mode = 'equal' then
    if p_proposed_equal_amount_minor is null or p_proposed_equal_amount_minor <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'vesty.contribution_proposal_invalid';
    end if;
  elsif p_proposed_equal_amount_minor is not null then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if p_base.mode = 'flexible' and p_proposed_mode = 'flexible' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  if p_base.mode = 'equal'
    and p_proposed_mode = 'equal'
    and p_base.equal_amount_minor = p_proposed_equal_amount_minor
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;
end;
$function$;

create function private.require_current_contribution_base_v1(
  p_club_id uuid,
  p_base_policy_version_id uuid
)
returns public.contribution_policy_versions
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_latest public.contribution_policy_versions%rowtype;
begin
  v_latest := private.latest_contribution_policy_row_v1(p_club_id);

  if v_latest.id is null
    or p_base_policy_version_id is null
    or v_latest.id <> p_base_policy_version_id
    or v_latest.club_id <> p_club_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_stale';
  end if;

  return v_latest;
end;
$function$;

create function private.initialize_flexible_commitments_from_equal_v1(
  p_club_id uuid,
  p_amount_minor bigint,
  p_currency text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  insert into public.member_contribution_commitment_versions (
    club_id,
    membership_id,
    version_number,
    amount_minor,
    currency
  )
  select
    p_club_id,
    membership.id,
    coalesce(
      (
        select max(commitment.version_number)
        from public.member_contribution_commitment_versions as commitment
        where commitment.membership_id = membership.id
      ),
      0
    ) + 1,
    p_amount_minor,
    p_currency
  from public.club_memberships as membership
  where membership.club_id = p_club_id
    and membership.status = 'active';
end;
$function$;

-- ---------------------------------------------------------------------------
-- Create / open / cancel / finalize
-- ---------------------------------------------------------------------------

create function private.create_contribution_policy_proposal_v1(
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

create function private.open_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status,
  electorate_size integer,
  required_yes_count integer,
  deadline_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_proposal public.contribution_policy_proposals%rowtype;
  v_club public.clubs%rowtype;
  v_size integer;
  v_required integer;
  v_opened timestamptz;
  v_deadline timestamptz;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_proposal.club_id::text || ':contribution-governance', 0)
  );

  if v_proposal.status <> 'draft' then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_not_draft';
  end if;

  select *
  into v_club
  from public.clubs as club
  where club.id = v_proposal.club_id;

  if not found
    or v_club.status <> 'active'
    or not exists (
      select 1
      from public.club_memberships as membership
      where membership.id = v_proposal.proposer_membership_id
        and membership.profile_id = v_user_id
        and membership.status = 'active'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_forbidden';
  end if;

  perform private.require_current_contribution_base_v1(
    v_proposal.club_id,
    v_proposal.base_contribution_policy_version_id
  );

  select count(*)
  into v_size
  from public.club_memberships as membership
  where membership.club_id = v_proposal.club_id
    and membership.status = 'active';

  if v_size is null or v_size <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'vesty.contribution_proposal_invalid';
  end if;

  v_required := private.required_yes_count_v1(v_club.governance_threshold_kind, v_size);
  v_opened := pg_catalog.now();
  v_deadline := v_opened + interval '7 days';

  insert into public.proposal_electorate_members (
    proposal_id,
    membership_id,
    club_id
  )
  select
    v_proposal.id,
    membership.id,
    v_proposal.club_id
  from public.club_memberships as membership
  where membership.club_id = v_proposal.club_id
    and membership.status = 'active';

  update public.contribution_policy_proposals as proposal
  set status = 'open',
      voting_threshold_kind = v_club.governance_threshold_kind,
      electorate_size = v_size,
      required_yes_count = v_required,
      intended_effective_at = v_opened,
      opened_at = v_opened,
      deadline_at = v_deadline,
      updated_at = v_opened
  where proposal.id = v_proposal.id;

  return query
  select
    v_proposal.id,
    'open'::public.strategy_proposal_status,
    v_size,
    v_required,
    v_deadline;
end;
$function$;

create function private.cancel_contribution_policy_proposal_v1(p_proposal_id uuid)
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
      closed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where proposal.id = v_proposal.id;

  return query
  select v_proposal.id, 'cancelled'::public.strategy_proposal_status;
end;
$function$;

create function private.apply_approved_contribution_policy_proposal_v1(
  p_proposal public.contribution_policy_proposals
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_base public.contribution_policy_versions%rowtype;
  v_policy_id uuid;
  v_existing uuid;
begin
  select policy.id
  into v_existing
  from public.contribution_policy_versions as policy
  where policy.source_proposal_id = p_proposal.id;

  if v_existing is not null then
    return v_existing;
  end if;

  v_base := private.require_current_contribution_base_v1(
    p_proposal.club_id,
    p_proposal.base_contribution_policy_version_id
  );
  perform private.validate_contribution_policy_change_v1(
    v_base,
    p_proposal.proposed_mode,
    p_proposal.proposed_equal_amount_minor
  );

  select created.policy_version_id
  into v_policy_id
  from private.create_contribution_policy_version_v1(
    p_proposal.club_id,
    p_proposal.proposed_mode,
    p_proposal.proposed_equal_amount_minor,
    p_proposal.id,
    p_proposal.proposer_membership_id
  ) as created;

  if p_proposal.proposed_mode = 'flexible' and v_base.mode = 'equal' then
    perform private.initialize_flexible_commitments_from_equal_v1(
      p_proposal.club_id,
      v_base.equal_amount_minor,
      v_base.currency
    );
  end if;

  return v_policy_id;
end;
$function$;

create function private.finalize_contribution_policy_proposal_v1(p_proposal_id uuid)
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
  elsif v_remaining < (v_proposal.required_yes_count - v_yes) then
    v_next_status := 'rejected';
  elsif v_now >= v_proposal.deadline_at then
    v_next_status := 'expired';
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
      closed_at = v_now,
      updated_at = v_now
  where proposal.id = v_proposal.id;

  return query
  select v_proposal.id, v_next_status, null::uuid;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Read model
-- ---------------------------------------------------------------------------

create function private.club_contribution_policy_proposals_v1(p_club_id uuid)
returns table (
  proposal_id uuid,
  club_id uuid,
  proposer_membership_id uuid,
  status public.strategy_proposal_status,
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

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------

create function public.create_contribution_policy_proposal_v1(
  p_club_id uuid,
  p_base_contribution_policy_version_id uuid,
  p_proposed_mode public.contribution_policy_mode,
  p_proposed_equal_amount_minor bigint default null
)
returns table (
  proposal_id uuid,
  club_id uuid,
  status public.strategy_proposal_status,
  base_contribution_policy_version_id uuid,
  proposed_mode public.contribution_policy_mode,
  proposed_equal_amount_minor bigint
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.create_contribution_policy_proposal_v1(
    p_club_id,
    p_base_contribution_policy_version_id,
    p_proposed_mode,
    p_proposed_equal_amount_minor
  );
$function$;

create function public.open_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status,
  electorate_size integer,
  required_yes_count integer,
  deadline_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.open_contribution_policy_proposal_v1(p_proposal_id);
$function$;

create function public.cancel_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.cancel_contribution_policy_proposal_v1(p_proposal_id);
$function$;

create function public.finalize_contribution_policy_proposal_v1(p_proposal_id uuid)
returns table (
  proposal_id uuid,
  status public.strategy_proposal_status,
  policy_version_id uuid
)
language sql
volatile
security invoker
set search_path = ''
as $function$
  select *
  from private.finalize_contribution_policy_proposal_v1(p_proposal_id);
$function$;

create function public.club_contribution_policy_proposals_v1(p_club_id uuid)
returns table (
  proposal_id uuid,
  club_id uuid,
  proposer_membership_id uuid,
  status public.strategy_proposal_status,
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

comment on function public.create_contribution_policy_proposal_v1(uuid, uuid, public.contribution_policy_mode, bigint) is
  'Creates a draft contribution-policy change. Any active member may propose. Does not create a policy version.';

comment on function public.open_contribution_policy_proposal_v1(uuid) is
  'Opens a draft, freezes the electorate from current active memberships, and snapshots the club voting rule. Base must still be the latest policy.';

comment on function public.finalize_contribution_policy_proposal_v1(uuid) is
  'Tallies an open contribution proposal. Approval atomically creates one ContributionPolicyVersion. Stale bases close as rejected without a new version.';

comment on function public.club_contribution_policy_proposals_v1(uuid) is
  'Club-readable contribution proposal list. Base/proposed styles and shared Equal amounts only. Never returns private Flexible commitments.';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on function private.ensure_club_proposal_identity() from public, anon, authenticated;
revoke all on function private.club_proposal_governance(uuid) from public, anon, authenticated;
revoke all on function private.required_yes_count_v1(public.governance_threshold_kind, integer) from public, anon, authenticated;
revoke all on function private.latest_contribution_policy_row_v1(uuid) from public, anon, authenticated;
revoke all on function private.validate_contribution_policy_change_v1(public.contribution_policy_versions, public.contribution_policy_mode, bigint) from public, anon, authenticated;
revoke all on function private.require_current_contribution_base_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.initialize_flexible_commitments_from_equal_v1(uuid, bigint, text) from public, anon, authenticated;
revoke all on function private.create_contribution_policy_proposal_v1(uuid, uuid, public.contribution_policy_mode, bigint) from public, anon, authenticated;
revoke all on function private.open_contribution_policy_proposal_v1(uuid) from public, anon, authenticated;
revoke all on function private.cancel_contribution_policy_proposal_v1(uuid) from public, anon, authenticated;
revoke all on function private.apply_approved_contribution_policy_proposal_v1(public.contribution_policy_proposals) from public, anon, authenticated;
revoke all on function private.finalize_contribution_policy_proposal_v1(uuid) from public, anon, authenticated;
revoke all on function private.club_contribution_policy_proposals_v1(uuid) from public, anon, authenticated;
revoke all on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint, uuid, uuid) from public, anon, authenticated;

grant execute on function private.create_contribution_policy_proposal_v1(uuid, uuid, public.contribution_policy_mode, bigint) to authenticated;
grant execute on function private.open_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function private.cancel_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function private.finalize_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function private.club_contribution_policy_proposals_v1(uuid) to authenticated;
grant execute on function private.create_contribution_policy_version_v1(uuid, public.contribution_policy_mode, bigint, uuid, uuid) to service_role;

revoke all on function public.create_contribution_policy_proposal_v1(uuid, uuid, public.contribution_policy_mode, bigint) from public, anon;
revoke all on function public.open_contribution_policy_proposal_v1(uuid) from public, anon;
revoke all on function public.cancel_contribution_policy_proposal_v1(uuid) from public, anon;
revoke all on function public.finalize_contribution_policy_proposal_v1(uuid) from public, anon;
revoke all on function public.club_contribution_policy_proposals_v1(uuid) from public, anon;

grant execute on function public.create_contribution_policy_proposal_v1(uuid, uuid, public.contribution_policy_mode, bigint) to authenticated;
grant execute on function public.open_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function public.cancel_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function public.finalize_contribution_policy_proposal_v1(uuid) to authenticated;
grant execute on function public.club_contribution_policy_proposals_v1(uuid) to authenticated;
