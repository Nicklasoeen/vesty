create type public.club_status as enum (
  'active',
  'archived'
);

create type public.governance_threshold_kind as enum (
  'simple_majority',
  'supermajority',
  'unanimous'
);

create type public.membership_status as enum (
  'active',
  'left',
  'removed'
);

create type public.club_invitation_status as enum (
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired'
);

create type public.ownership_transfer_status as enum (
  'pending',
  'accepted',
  'rejected',
  'expired'
);

create type public.investment_target_kind as enum (
  'fund',
  'etf'
);

create type public.investment_target_status as enum (
  'active',
  'inactive'
);

create type public.strategy_version_origin as enum (
  'genesis',
  'proposal'
);

create type public.strategy_proposal_status as enum (
  'draft',
  'open',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

create type public.vote_choice as enum (
  'yes',
  'no'
);

create type public.strategy_readiness_status as enum (
  'pending',
  'ready'
);

create type public.investment_schedule_status as enum (
  'scheduled',
  'active',
  'paused',
  'replaced',
  'ended'
);

create type public.investment_cycle_status as enum (
  'upcoming',
  'open',
  'completed',
  'cancelled'
);

create type public.member_saving_plan_status as enum (
  'active',
  'inactive',
  'replaced'
);

create type public.participation_outcome as enum (
  'expected',
  'confirmed',
  'skipped',
  'failed'
);

create type public.member_report_source as enum (
  'member_reported'
);

create type public.verification_state as enum (
  'unverified',
  'verified'
);

create type public.verification_source as enum (
  'import',
  'broker_api',
  'embedded_broker'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_check
    check (display_name is null or btrim(display_name) <> ''),
  constraint profiles_updated_at_check
    check (updated_at >= created_at)
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.club_status not null default 'active',
  base_currency text not null,
  governance_threshold_kind public.governance_threshold_kind not null,
  current_owner_membership_id uuid not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint clubs_name_check
    check (btrim(name) <> ''),
  constraint clubs_base_currency_check
    check (base_currency ~ '^[A-Z]{3}$'),
  constraint clubs_lifecycle_check
    check (
      (status = 'active' and archived_at is null)
      or
      (status = 'archived' and archived_at is not null)
    ),
  constraint clubs_archived_at_check
    check (archived_at is null or archived_at >= created_at)
);

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  removed_by_membership_id uuid,
  active_membership_id uuid generated always as (
    case
      when status = 'active' then id
      else null
    end
  ) stored,

  constraint club_memberships_club_id_id_key
    unique (club_id, id),
  constraint club_memberships_active_identity_key
    unique (club_id, active_membership_id),
  constraint club_memberships_lifecycle_check
    check (
      (status = 'active' and ended_at is null and removed_by_membership_id is null)
      or
      (status = 'left' and ended_at is not null and removed_by_membership_id is null)
      or
      (status = 'removed' and ended_at is not null and removed_by_membership_id is not null)
    ),
  constraint club_memberships_ended_at_check
    check (ended_at is null or ended_at >= joined_at),
  constraint club_memberships_removed_by_same_club_fkey
    foreign key (club_id, removed_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict
);

-- OWNER is represented by this required relationship rather than a second,
-- potentially contradictory role column. The generated target key guarantees
-- that the owner belongs to the club and remains an active membership.
alter table public.clubs
  add constraint clubs_current_owner_membership_fkey
  foreign key (id, current_owner_membership_id)
  references public.club_memberships (club_id, active_membership_id)
  on delete no action
  deferrable initially deferred;

create unique index club_memberships_one_active_tenure_idx
  on public.club_memberships (club_id, profile_id)
  where status = 'active';

create index club_memberships_profile_history_idx
  on public.club_memberships (profile_id, joined_at desc);

create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  invited_by_membership_id uuid not null,
  invitee_profile_id uuid references public.profiles (id) on delete restrict,
  invitee_email text,
  status public.club_invitation_status not null default 'pending',
  accepted_membership_id uuid unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  expired_at timestamptz,

  constraint club_invitations_club_id_id_key
    unique (club_id, id),
  constraint club_invitations_inviter_same_club_fkey
    foreign key (club_id, invited_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint club_invitations_accepted_membership_same_club_fkey
    foreign key (club_id, accepted_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint club_invitations_invitee_check
    check (num_nonnulls(invitee_profile_id, invitee_email) = 1),
  constraint club_invitations_email_check
    check (invitee_email is null or btrim(invitee_email) <> ''),
  constraint club_invitations_expiration_check
    check (expires_at > created_at),
  constraint club_invitations_terminal_timestamps_check
    check (
      (accepted_at is null or accepted_at >= created_at)
      and (declined_at is null or declined_at >= created_at)
      and (revoked_at is null or revoked_at >= created_at)
      and (expired_at is null or expired_at >= created_at)
    ),
  constraint club_invitations_lifecycle_check
    check (
      (
        status = 'pending'
        and accepted_membership_id is null
        and num_nonnulls(accepted_at, declined_at, revoked_at, expired_at) = 0
      )
      or
      (
        status = 'accepted'
        and accepted_membership_id is not null
        and accepted_at is not null
        and num_nonnulls(declined_at, revoked_at, expired_at) = 0
      )
      or
      (
        status = 'declined'
        and accepted_membership_id is null
        and declined_at is not null
        and num_nonnulls(accepted_at, revoked_at, expired_at) = 0
      )
      or
      (
        status = 'revoked'
        and accepted_membership_id is null
        and revoked_at is not null
        and num_nonnulls(accepted_at, declined_at, expired_at) = 0
      )
      or
      (
        status = 'expired'
        and accepted_membership_id is null
        and expired_at is not null
        and num_nonnulls(accepted_at, declined_at, revoked_at) = 0
      )
    )
);

create unique index club_invitations_one_pending_profile_idx
  on public.club_invitations (club_id, invitee_profile_id)
  where status = 'pending' and invitee_profile_id is not null;

create unique index club_invitations_one_pending_email_idx
  on public.club_invitations (club_id, lower(btrim(invitee_email)))
  where status = 'pending' and invitee_email is not null;

create index club_invitations_club_status_idx
  on public.club_invitations (club_id, status, created_at desc);

create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  initiating_owner_membership_id uuid not null,
  target_membership_id uuid not null,
  status public.ownership_transfer_status not null default 'pending',
  initiated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_by_membership_id uuid,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,

  constraint ownership_transfers_club_id_id_key
    unique (club_id, id),
  constraint ownership_transfers_initiator_same_club_fkey
    foreign key (club_id, initiating_owner_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint ownership_transfers_target_same_club_fkey
    foreign key (club_id, target_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint ownership_transfers_resolver_same_club_fkey
    foreign key (club_id, resolved_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint ownership_transfers_distinct_memberships_check
    check (initiating_owner_membership_id <> target_membership_id),
  constraint ownership_transfers_expiration_check
    check (expires_at > initiated_at),
  constraint ownership_transfers_terminal_timestamps_check
    check (
      (accepted_at is null or accepted_at >= initiated_at)
      and (rejected_at is null or rejected_at >= initiated_at)
      and (expired_at is null or expired_at >= initiated_at)
    ),
  constraint ownership_transfers_lifecycle_check
    check (
      (
        status = 'pending'
        and resolved_by_membership_id is null
        and num_nonnulls(accepted_at, rejected_at, expired_at) = 0
      )
      or
      (
        status = 'accepted'
        and resolved_by_membership_id = target_membership_id
        and accepted_at is not null
        and num_nonnulls(rejected_at, expired_at) = 0
      )
      or
      (
        status = 'rejected'
        and resolved_by_membership_id = target_membership_id
        and rejected_at is not null
        and num_nonnulls(accepted_at, expired_at) = 0
      )
      or
      (
        status = 'expired'
        and resolved_by_membership_id is null
        and expired_at is not null
        and num_nonnulls(accepted_at, rejected_at) = 0
      )
    )
);

create unique index ownership_transfers_one_pending_per_club_idx
  on public.ownership_transfers (club_id)
  where status = 'pending';

create index ownership_transfers_target_pending_idx
  on public.ownership_transfers (target_membership_id, initiated_at desc)
  where status = 'pending';

create table public.investment_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.investment_target_kind not null,
  status public.investment_target_status not null default 'active',
  isin text,
  ticker text,
  exchange text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint investment_targets_name_check
    check (btrim(name) <> ''),
  constraint investment_targets_isin_check
    check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  constraint investment_targets_ticker_check
    check (ticker is null or btrim(ticker) <> ''),
  constraint investment_targets_exchange_check
    check (exchange is null or btrim(exchange) <> ''),
  constraint investment_targets_updated_at_check
    check (updated_at >= created_at)
);

create unique index investment_targets_isin_key
  on public.investment_targets (isin)
  where isin is not null;

create index investment_targets_active_name_idx
  on public.investment_targets (name)
  where status = 'active';

create table public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  version_number integer not null,
  created_by_membership_id uuid not null,
  origin public.strategy_version_origin not null,
  source_proposal_id uuid unique,
  approved_at timestamptz,
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint strategy_versions_club_id_id_key
    unique (club_id, id),
  constraint strategy_versions_club_version_key
    unique (club_id, version_number),
  constraint strategy_versions_creator_same_club_fkey
    foreign key (club_id, created_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint strategy_versions_provenance_check
    check (
      (
        origin = 'genesis'
        and version_number = 1
        and source_proposal_id is null
        and approved_at is null
        and effective_at >= created_at
      )
      or
      (
        origin = 'proposal'
        and version_number > 1
        and source_proposal_id is not null
        and approved_at is not null
        and effective_at >= approved_at
      )
    )
);

create index strategy_versions_club_effective_at_idx
  on public.strategy_versions (club_id, effective_at desc);

create table public.strategy_allocations (
  id uuid primary key default gen_random_uuid(),
  strategy_version_id uuid not null
    references public.strategy_versions (id) on delete restrict,
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  allocation_bps smallint not null,
  position smallint not null,
  target_name text not null,
  target_kind public.investment_target_kind not null,
  target_isin text,
  target_ticker text,
  target_exchange text,

  constraint strategy_allocations_version_target_key
    unique (strategy_version_id, investment_target_id),
  constraint strategy_allocations_version_position_key
    unique (strategy_version_id, position),
  constraint strategy_allocations_bps_check
    check (allocation_bps between 1 and 10000),
  constraint strategy_allocations_position_check
    check (position > 0),
  constraint strategy_allocations_target_name_check
    check (btrim(target_name) <> ''),
  constraint strategy_allocations_target_isin_check
    check (target_isin is null or target_isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  constraint strategy_allocations_target_ticker_check
    check (target_ticker is null or btrim(target_ticker) <> ''),
  constraint strategy_allocations_target_exchange_check
    check (target_exchange is null or btrim(target_exchange) <> '')
);

create table public.strategy_proposals (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  proposer_membership_id uuid not null,
  base_strategy_version_id uuid not null,
  status public.strategy_proposal_status not null default 'draft',
  reason text,
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

  constraint strategy_proposals_club_id_id_key
    unique (club_id, id),
  constraint strategy_proposals_proposer_same_club_fkey
    foreign key (club_id, proposer_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint strategy_proposals_base_version_same_club_fkey
    foreign key (club_id, base_strategy_version_id)
    references public.strategy_versions (club_id, id)
    on delete restrict,
  constraint strategy_proposals_reason_check
    check (reason is null or btrim(reason) <> ''),
  constraint strategy_proposals_updated_at_check
    check (updated_at >= created_at),
  constraint strategy_proposals_open_snapshot_check
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
  constraint strategy_proposals_threshold_check
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
  constraint strategy_proposals_deadline_check
    check (deadline_at is null or deadline_at > opened_at),
  constraint strategy_proposals_closed_at_check
    check (closed_at is null or closed_at >= coalesce(opened_at, created_at)),
  constraint strategy_proposals_approved_at_check
    check (
      approved_at is null
      or (
        opened_at is not null
        and closed_at is not null
        and approved_at >= opened_at
        and approved_at <= closed_at
      )
    ),
  constraint strategy_proposals_lifecycle_check
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

create unique index strategy_proposals_one_open_per_club_idx
  on public.strategy_proposals (club_id)
  where status = 'open';

create index strategy_proposals_club_status_idx
  on public.strategy_proposals (club_id, status, created_at desc);

create table public.strategy_proposal_allocations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null
    references public.strategy_proposals (id) on delete restrict,
  investment_target_id uuid not null
    references public.investment_targets (id) on delete restrict,
  allocation_bps smallint not null,
  position smallint not null,
  target_name text not null,
  target_kind public.investment_target_kind not null,
  target_isin text,
  target_ticker text,
  target_exchange text,

  constraint strategy_proposal_allocations_proposal_target_key
    unique (proposal_id, investment_target_id),
  constraint strategy_proposal_allocations_proposal_position_key
    unique (proposal_id, position),
  constraint strategy_proposal_allocations_bps_check
    check (allocation_bps between 1 and 10000),
  constraint strategy_proposal_allocations_position_check
    check (position > 0),
  constraint strategy_proposal_allocations_target_name_check
    check (btrim(target_name) <> ''),
  constraint strategy_proposal_allocations_target_isin_check
    check (target_isin is null or target_isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  constraint strategy_proposal_allocations_target_ticker_check
    check (target_ticker is null or btrim(target_ticker) <> ''),
  constraint strategy_proposal_allocations_target_exchange_check
    check (target_exchange is null or btrim(target_exchange) <> '')
);

create table public.proposal_electorate_members (
  proposal_id uuid not null,
  membership_id uuid not null,
  club_id uuid not null,
  snapshotted_at timestamptz not null default now(),

  primary key (proposal_id, membership_id),
  constraint proposal_electorate_members_proposal_same_club_fkey
    foreign key (club_id, proposal_id)
    references public.strategy_proposals (club_id, id)
    on delete restrict,
  constraint proposal_electorate_members_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict
);

create index proposal_electorate_members_membership_idx
  on public.proposal_electorate_members (membership_id, proposal_id);

create table public.votes (
  proposal_id uuid not null,
  membership_id uuid not null,
  choice public.vote_choice not null,
  cast_at timestamptz not null default now(),

  primary key (proposal_id, membership_id),
  constraint votes_electorate_member_fkey
    foreign key (proposal_id, membership_id)
    references public.proposal_electorate_members (proposal_id, membership_id)
    on delete restrict
);

create index votes_membership_idx
  on public.votes (membership_id, proposal_id);

alter table public.strategy_versions
  add constraint strategy_versions_source_proposal_same_club_fkey
  foreign key (club_id, source_proposal_id)
  references public.strategy_proposals (club_id, id)
  on delete restrict;

create table public.strategy_readiness (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  strategy_version_id uuid not null,
  status public.strategy_readiness_status not null default 'pending',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,

  constraint strategy_readiness_membership_version_key
    unique (membership_id, strategy_version_id),
  constraint strategy_readiness_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint strategy_readiness_version_same_club_fkey
    foreign key (club_id, strategy_version_id)
    references public.strategy_versions (club_id, id)
    on delete restrict,
  constraint strategy_readiness_lifecycle_check
    check (
      (status = 'pending' and confirmed_at is null)
      or
      (
        status = 'ready'
        and confirmed_at is not null
        and confirmed_at >= created_at
      )
    )
);

create index strategy_readiness_version_status_idx
  on public.strategy_readiness (strategy_version_id, status);

create table public.investment_schedules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete restrict,
  revision_number integer not null,
  status public.investment_schedule_status not null default 'scheduled',
  day_of_month smallint not null,
  missing_day_policy text not null,
  timezone text not null,
  configuration_lead_days smallint not null default 3,
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),

  constraint investment_schedules_club_id_id_key
    unique (club_id, id),
  constraint investment_schedules_club_revision_key
    unique (club_id, revision_number),
  constraint investment_schedules_creator_same_club_fkey
    foreign key (club_id, created_by_membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint investment_schedules_revision_check
    check (revision_number > 0),
  constraint investment_schedules_day_of_month_check
    check (day_of_month between 1 and 31),
  constraint investment_schedules_missing_day_policy_check
    check (btrim(missing_day_policy) <> ''),
  constraint investment_schedules_timezone_check
    check (btrim(timezone) <> ''),
  constraint investment_schedules_lead_days_check
    check (configuration_lead_days >= 0),
  constraint investment_schedules_effective_period_check
    check (effective_until is null or effective_until > effective_from),
  constraint investment_schedules_terminal_status_check
    check (
      status not in ('replaced', 'ended')
      or effective_until is not null
    )
);

create unique index investment_schedules_one_current_per_club_idx
  on public.investment_schedules (club_id)
  where status in ('active', 'paused');

create table public.investment_cycles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  investment_schedule_id uuid not null,
  strategy_version_id uuid not null,
  occurrence_key text not null,
  investment_day_at timestamptz not null,
  configuration_deadline_at timestamptz not null,
  reporting_opens_at timestamptz not null,
  reporting_closes_at timestamptz not null,
  timezone text not null,
  status public.investment_cycle_status not null default 'upcoming',
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  cancellation_reason text,

  constraint investment_cycles_club_id_id_key
    unique (club_id, id),
  constraint investment_cycles_club_occurrence_key
    unique (club_id, occurrence_key),
  constraint investment_cycles_schedule_same_club_fkey
    foreign key (club_id, investment_schedule_id)
    references public.investment_schedules (club_id, id)
    on delete restrict,
  constraint investment_cycles_version_same_club_fkey
    foreign key (club_id, strategy_version_id)
    references public.strategy_versions (club_id, id)
    on delete restrict,
  constraint investment_cycles_occurrence_key_check
    check (btrim(occurrence_key) <> ''),
  constraint investment_cycles_deadline_check
    check (configuration_deadline_at < investment_day_at),
  constraint investment_cycles_reporting_window_check
    check (reporting_opens_at < reporting_closes_at),
  constraint investment_cycles_timezone_check
    check (btrim(timezone) <> ''),
  constraint investment_cycles_closed_at_check
    check (closed_at is null or closed_at >= coalesce(opened_at, created_at)),
  constraint investment_cycles_cancellation_reason_check
    check (cancellation_reason is null or btrim(cancellation_reason) <> ''),
  constraint investment_cycles_lifecycle_check
    check (
      (
        status = 'upcoming'
        and opened_at is null
        and closed_at is null
        and cancellation_reason is null
      )
      or
      (
        status = 'open'
        and opened_at is not null
        and closed_at is null
        and cancellation_reason is null
      )
      or
      (
        status = 'completed'
        and opened_at is not null
        and closed_at is not null
        and cancellation_reason is null
      )
      or
      (
        status = 'cancelled'
        and closed_at is not null
        and cancellation_reason is not null
      )
    )
);

create index investment_cycles_club_day_idx
  on public.investment_cycles (club_id, investment_day_at desc);

create index investment_cycles_schedule_idx
  on public.investment_cycles (investment_schedule_id);

create index investment_cycles_strategy_version_idx
  on public.investment_cycles (strategy_version_id);

create table public.member_saving_plans (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  membership_id uuid not null,
  amount_minor bigint not null,
  currency text not null,
  status public.member_saving_plan_status not null default 'active',
  active_from timestamptz not null,
  active_until timestamptz,
  replaces_plan_id uuid,
  created_at timestamptz not null default now(),

  constraint member_saving_plans_club_membership_id_key
    unique (club_id, membership_id, id),
  constraint member_saving_plans_membership_id_key
    unique (membership_id, id),
  constraint member_saving_plans_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_saving_plans_replaces_same_membership_fkey
    foreign key (membership_id, replaces_plan_id)
    references public.member_saving_plans (membership_id, id)
    on delete restrict,
  constraint member_saving_plans_amount_check
    check (amount_minor > 0),
  constraint member_saving_plans_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint member_saving_plans_effective_period_check
    check (active_until is null or active_until > active_from),
  constraint member_saving_plans_replacement_check
    check (replaces_plan_id is null or replaces_plan_id <> id),
  constraint member_saving_plans_lifecycle_check
    check (
      status = 'active'
      or (
        status in ('inactive', 'replaced')
        and active_until is not null
      )
    )
);

create unique index member_saving_plans_one_active_per_membership_idx
  on public.member_saving_plans (membership_id)
  where status = 'active';

create index member_saving_plans_membership_effective_idx
  on public.member_saving_plans (membership_id, active_from desc);

create table public.member_cycle_participations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  investment_cycle_id uuid not null,
  membership_id uuid not null,
  saving_plan_id uuid not null,
  expected_amount_minor bigint not null,
  currency text not null,
  outcome public.participation_outcome not null default 'expected',
  report_source public.member_report_source,
  reported_at timestamptz,
  corrected_at timestamptz,
  verification_state public.verification_state not null default 'unverified',
  verification_source public.verification_source,
  verified_at timestamptz,
  created_at timestamptz not null default now(),

  constraint member_cycle_participations_cycle_membership_key
    unique (investment_cycle_id, membership_id),
  constraint member_cycle_participations_cycle_same_club_fkey
    foreign key (club_id, investment_cycle_id)
    references public.investment_cycles (club_id, id)
    on delete restrict,
  constraint member_cycle_participations_membership_same_club_fkey
    foreign key (club_id, membership_id)
    references public.club_memberships (club_id, id)
    on delete restrict,
  constraint member_cycle_participations_plan_same_member_fkey
    foreign key (club_id, membership_id, saving_plan_id)
    references public.member_saving_plans (club_id, membership_id, id)
    on delete restrict,
  constraint member_cycle_participations_amount_check
    check (expected_amount_minor > 0),
  constraint member_cycle_participations_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint member_cycle_participations_report_check
    check (
      (
        outcome = 'expected'
        and report_source is null
        and reported_at is null
        and corrected_at is null
      )
      or
      (
        outcome in ('confirmed', 'skipped', 'failed')
        and report_source = 'member_reported'
        and reported_at is not null
        and reported_at >= created_at
        and (corrected_at is null or corrected_at >= reported_at)
      )
    ),
  constraint member_cycle_participations_verification_check
    check (
      (
        verification_state = 'unverified'
        and verification_source is null
        and verified_at is null
      )
      or
      (
        verification_state = 'verified'
        and verification_source is not null
        and verified_at is not null
        and verified_at >= created_at
      )
    )
);

create index member_cycle_participations_membership_idx
  on public.member_cycle_participations (membership_id, investment_cycle_id);

create index member_cycle_participations_saving_plan_idx
  on public.member_cycle_participations (saving_plan_id);
