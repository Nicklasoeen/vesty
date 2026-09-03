create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.is_active_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.club_memberships as membership
    where membership.club_id = p_club_id
      and membership.profile_id = (select auth.uid())
      and membership.status = 'active'
  );
$function$;

create or replace function private.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.clubs as club
    join public.club_memberships as membership
      on membership.id = club.current_owner_membership_id
     and membership.club_id = club.id
    where club.id = p_club_id
      and membership.profile_id = (select auth.uid())
      and membership.status = 'active'
  );
$function$;

create or replace function private.owns_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.club_memberships as membership
    where membership.id = p_membership_id
      and membership.profile_id = (select auth.uid())
  );
$function$;

create or replace function private.owns_active_membership(p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.club_memberships as membership
    where membership.id = p_membership_id
      and membership.profile_id = (select auth.uid())
      and membership.status = 'active'
  );
$function$;

create or replace function private.can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null
    and (
      p_profile_id = (select auth.uid())
      or exists (
        select 1
        from public.club_memberships as visible_membership
        join public.club_memberships as requesting_membership
          on requesting_membership.club_id = visible_membership.club_id
        where visible_membership.profile_id = p_profile_id
          and requesting_membership.profile_id = (select auth.uid())
          and requesting_membership.status = 'active'
      )
    );
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
    from public.strategy_proposals as proposal
    where proposal.id = p_proposal_id
      and (
        exists (
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
            where electorate.proposal_id = proposal.id
              and membership.profile_id = (select auth.uid())
          )
        )
      )
  );
$function$;

create or replace function private.can_edit_draft_proposal(p_proposal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.strategy_proposals as proposal
    join public.club_memberships as membership
      on membership.id = proposal.proposer_membership_id
     and membership.club_id = proposal.club_id
    where proposal.id = p_proposal_id
      and proposal.status = 'draft'
      and membership.profile_id = (select auth.uid())
      and membership.status = 'active'
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
    from public.strategy_proposals as proposal
    join public.proposal_electorate_members as electorate
      on electorate.proposal_id = proposal.id
     and electorate.membership_id = p_membership_id
    join public.club_memberships as membership
      on membership.id = electorate.membership_id
    where proposal.id = p_proposal_id
      and proposal.status = 'open'
      and proposal.deadline_at > now()
      and membership.profile_id = (select auth.uid())
  );
$function$;

create or replace function private.can_update_participation(
  p_participation_id uuid
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
    join public.club_memberships as membership
      on membership.id = participation.membership_id
     and membership.club_id = participation.club_id
    join public.investment_cycles as cycle
      on cycle.id = participation.investment_cycle_id
     and cycle.club_id = participation.club_id
    where participation.id = p_participation_id
      and membership.profile_id = (select auth.uid())
      and membership.status = 'active'
      and cycle.status = 'open'
  );
$function$;

revoke all on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_club_member(uuid) to authenticated;
grant execute on function private.is_club_owner(uuid) to authenticated;
grant execute on function private.owns_membership(uuid) to authenticated;
grant execute on function private.owns_active_membership(uuid) to authenticated;
grant execute on function private.can_read_profile(uuid) to authenticated;
grant execute on function private.can_access_proposal(uuid) to authenticated;
grant execute on function private.can_edit_draft_proposal(uuid) to authenticated;
grant execute on function private.can_cast_vote(uuid, uuid) to authenticated;
grant execute on function private.can_update_participation(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.clubs enable row level security;
alter table public.clubs force row level security;
alter table public.club_memberships enable row level security;
alter table public.club_memberships force row level security;
alter table public.club_invitations enable row level security;
alter table public.club_invitations force row level security;
alter table public.ownership_transfers enable row level security;
alter table public.ownership_transfers force row level security;
alter table public.investment_targets enable row level security;
alter table public.investment_targets force row level security;
alter table public.strategy_versions enable row level security;
alter table public.strategy_versions force row level security;
alter table public.strategy_allocations enable row level security;
alter table public.strategy_allocations force row level security;
alter table public.strategy_proposals enable row level security;
alter table public.strategy_proposals force row level security;
alter table public.strategy_proposal_allocations enable row level security;
alter table public.strategy_proposal_allocations force row level security;
alter table public.proposal_electorate_members enable row level security;
alter table public.proposal_electorate_members force row level security;
alter table public.votes enable row level security;
alter table public.votes force row level security;
alter table public.strategy_readiness enable row level security;
alter table public.strategy_readiness force row level security;
alter table public.investment_schedules enable row level security;
alter table public.investment_schedules force row level security;
alter table public.investment_cycles enable row level security;
alter table public.investment_cycles force row level security;
alter table public.member_saving_plans enable row level security;
alter table public.member_saving_plans force row level security;
alter table public.member_cycle_participations enable row level security;
alter table public.member_cycle_participations force row level security;

revoke all privileges on all tables in schema public
  from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.clubs to authenticated;
grant select on public.club_memberships to authenticated;
grant select on public.club_invitations to authenticated;
grant select on public.ownership_transfers to authenticated;
grant select on public.investment_targets to authenticated;
grant select on public.strategy_versions to authenticated;
grant select on public.strategy_allocations to authenticated;

grant select on public.strategy_proposals to authenticated;
grant insert (
  club_id,
  proposer_membership_id,
  base_strategy_version_id,
  reason
) on public.strategy_proposals to authenticated;
grant update (
  reason,
  base_strategy_version_id
) on public.strategy_proposals to authenticated;

grant select on public.strategy_proposal_allocations to authenticated;
grant insert (
  proposal_id,
  investment_target_id,
  allocation_bps,
  position,
  target_name,
  target_kind,
  target_isin,
  target_ticker,
  target_exchange
) on public.strategy_proposal_allocations to authenticated;
grant update (
  investment_target_id,
  allocation_bps,
  position,
  target_name,
  target_kind,
  target_isin,
  target_ticker,
  target_exchange
) on public.strategy_proposal_allocations to authenticated;
grant delete on public.strategy_proposal_allocations to authenticated;

grant select on public.proposal_electorate_members to authenticated;
grant select on public.votes to authenticated;
grant insert (proposal_id, membership_id, choice)
  on public.votes to authenticated;

grant select on public.strategy_readiness to authenticated;
grant insert (
  club_id,
  membership_id,
  strategy_version_id,
  status,
  confirmed_at
) on public.strategy_readiness to authenticated;
grant update (status, confirmed_at)
  on public.strategy_readiness to authenticated;

grant select on public.investment_schedules to authenticated;
grant select on public.investment_cycles to authenticated;

grant select on public.member_saving_plans to authenticated;
grant insert (
  club_id,
  membership_id,
  amount_minor,
  currency,
  active_from,
  replaces_plan_id
) on public.member_saving_plans to authenticated;
grant update (status, active_until)
  on public.member_saving_plans to authenticated;

grant select on public.member_cycle_participations to authenticated;
grant update (
  outcome,
  report_source,
  reported_at,
  corrected_at
) on public.member_cycle_participations to authenticated;

create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using ((select private.can_read_profile(id)));

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy clubs_select_active_members
on public.clubs
for select
to authenticated
using ((select private.is_active_club_member(id)));

create policy club_memberships_select_active_club_members
on public.club_memberships
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy club_invitations_select_owner_or_profile_recipient
on public.club_invitations
for select
to authenticated
using (
  invitee_profile_id = (select auth.uid())
  or (select private.is_club_owner(club_id))
);

create policy ownership_transfers_select_participants
on public.ownership_transfers
for select
to authenticated
using (
  (select private.is_club_owner(club_id))
  or (select private.owns_active_membership(target_membership_id))
);

create policy investment_targets_select_authenticated
on public.investment_targets
for select
to authenticated
using (true);

create policy strategy_versions_select_active_members
on public.strategy_versions
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy strategy_allocations_select_active_members
on public.strategy_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.strategy_versions as version
    where version.id = strategy_version_id
      and (select private.is_active_club_member(version.club_id))
  )
);

create policy strategy_proposals_select_authorized
on public.strategy_proposals
for select
to authenticated
using ((select private.can_access_proposal(id)));

create policy strategy_proposals_insert_own_draft
on public.strategy_proposals
for insert
to authenticated
with check (
  status = 'draft'
  and (select private.is_active_club_member(club_id))
  and (select private.owns_active_membership(proposer_membership_id))
);

create policy strategy_proposals_update_own_draft
on public.strategy_proposals
for update
to authenticated
using ((select private.can_edit_draft_proposal(id)))
with check ((select private.can_edit_draft_proposal(id)));

create policy strategy_proposal_allocations_select_authorized
on public.strategy_proposal_allocations
for select
to authenticated
using ((select private.can_access_proposal(proposal_id)));

create policy strategy_proposal_allocations_insert_own_draft
on public.strategy_proposal_allocations
for insert
to authenticated
with check (
  (select private.can_edit_draft_proposal(proposal_id))
  and exists (
    select 1
    from public.investment_targets as target
    where target.id = investment_target_id
      and target.status = 'active'
  )
);

create policy strategy_proposal_allocations_update_own_draft
on public.strategy_proposal_allocations
for update
to authenticated
using ((select private.can_edit_draft_proposal(proposal_id)))
with check (
  (select private.can_edit_draft_proposal(proposal_id))
  and exists (
    select 1
    from public.investment_targets as target
    where target.id = investment_target_id
      and target.status = 'active'
  )
);

create policy strategy_proposal_allocations_delete_own_draft
on public.strategy_proposal_allocations
for delete
to authenticated
using ((select private.can_edit_draft_proposal(proposal_id)));

create policy proposal_electorate_members_select_authorized
on public.proposal_electorate_members
for select
to authenticated
using (
  (select private.is_active_club_member(club_id))
  or (
    (select private.owns_membership(membership_id))
    and (select private.can_access_proposal(proposal_id))
  )
);

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
);

create policy votes_insert_eligible_electorate_member
on public.votes
for insert
to authenticated
with check (
  (select private.can_cast_vote(proposal_id, membership_id))
);

create policy strategy_readiness_select_active_members
on public.strategy_readiness
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy strategy_readiness_insert_self
on public.strategy_readiness
for insert
to authenticated
with check (
  (select private.is_active_club_member(club_id))
  and (select private.owns_active_membership(membership_id))
  and (confirmed_at is null or confirmed_at <= now())
);

create policy strategy_readiness_update_pending_to_ready
on public.strategy_readiness
for update
to authenticated
using (
  status = 'pending'
  and (select private.owns_active_membership(membership_id))
)
with check (
  status = 'ready'
  and confirmed_at is not null
  and confirmed_at <= now()
  and (select private.owns_active_membership(membership_id))
);

create policy investment_schedules_select_active_members
on public.investment_schedules
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy investment_cycles_select_active_members
on public.investment_cycles
for select
to authenticated
using ((select private.is_active_club_member(club_id)));

create policy member_saving_plans_select_self
on public.member_saving_plans
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

create policy member_saving_plans_insert_self
on public.member_saving_plans
for insert
to authenticated
with check (
  status = 'active'
  and active_until is null
  and (select private.owns_active_membership(membership_id))
  and (select private.is_active_club_member(club_id))
  and currency = (
    select club.base_currency
    from public.clubs as club
    where club.id = club_id
  )
);

create policy member_saving_plans_end_self
on public.member_saving_plans
for update
to authenticated
using (
  status = 'active'
  and (select private.owns_active_membership(membership_id))
)
with check (
  status in ('inactive', 'replaced')
  and active_until is not null
  and (select private.owns_active_membership(membership_id))
);

create policy member_cycle_participations_select_self
on public.member_cycle_participations
for select
to authenticated
using ((select private.owns_active_membership(membership_id)));

create policy member_cycle_participations_update_own_open_report
on public.member_cycle_participations
for update
to authenticated
using ((select private.can_update_participation(id)))
with check (
  outcome in ('confirmed', 'skipped', 'failed')
  and report_source = 'member_reported'
  and reported_at is not null
  and reported_at <= now()
  and (corrected_at is null or corrected_at <= now())
  and (select private.can_update_participation(id))
);
