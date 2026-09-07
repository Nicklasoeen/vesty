-- Flexible contribution amounts are private. Exact club-wide money totals,
-- returns, and history enable inference even when a contributor threshold is
-- used, so these unused client projections are removed from the Data API.
--
-- Caller-owned portfolio projections remain available.

drop function if exists public.club_estimated_portfolio_v1(uuid);
drop function if exists public.club_portfolio_history_v1(uuid, date, date, integer);

drop function if exists private.club_estimated_portfolio_v1(uuid);
drop function if exists private.club_portfolio_history_v1(uuid, date, date, integer);
