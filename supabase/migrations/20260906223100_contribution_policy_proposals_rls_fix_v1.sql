-- Keep vote privacy on already-granted helpers. Do not let RLS
-- invoke private.club_proposal_governance as authenticated.

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
