/**
 * DEMO DATA — Invest / Investment Day design spike only.
 *
 * Isolated from Supabase and the real domain. Amounts are pre-computed
 * integer NOK kroner. Allocation weights are integer basis points.
 * Do not derive money in UI components.
 */

import { BPS_PER_WHOLE, sumIntegerAmounts } from '@/lib/money';

export type InvestFlowPhase = 'upcoming' | 'today' | 'completed';

/**
 * Default screenshot / Expo Go entry: the action state.
 * Flip to 'upcoming' or 'completed' for visual QA of the other phases.
 */
export const INVEST_DEMO_DEFAULT_PHASE: InvestFlowPhase = 'today';

export interface InvestTargetDemo {
  id: string;
  label: string;
  /** Integer basis points (4000 = 40%). */
  allocationBps: number;
  /** Integer NOK kroner for this member this Investment Day. */
  amountNok: number;
}

export interface InvestPlanDemo {
  clubName: string;
  investmentDayLabel: string;
  investmentDayShortLabel: string;
  /** Integer NOK kroner this member invests today. */
  memberAmountNok: number;
  currency: 'NOK';
  /** Display name for the current demo broker. Not a provider registry. */
  brokerName: string;
  brokerActionLabel: string;
  targets: readonly InvestTargetDemo[];
}

export const investPlanDemo: InvestPlanDemo = {
  clubName: 'WRIC',
  investmentDayLabel: '5 October',
  investmentDayShortLabel: '5 Oct',
  memberAmountNok: 2_000,
  currency: 'NOK',
  brokerName: 'Nordnet',
  brokerActionLabel: 'Open in Nordnet',
  targets: [
    { id: 'global-index', label: 'Global Index', allocationBps: 4_000, amountNok: 800 },
    { id: 'technology', label: 'Technology', allocationBps: 3_000, amountNok: 600 },
    { id: 'norway', label: 'Norway', allocationBps: 1_500, amountNok: 300 },
    { id: 'emerging-markets', label: 'Emerging Markets', allocationBps: 1_500, amountNok: 300 },
  ],
};

const amountTotal = sumIntegerAmounts(investPlanDemo.targets.map((target) => target.amountNok));
const bpsTotal = sumIntegerAmounts(investPlanDemo.targets.map((target) => target.allocationBps));

if (amountTotal !== investPlanDemo.memberAmountNok) {
  throw new Error('Invest demo target amounts must sum to memberAmountNok');
}

if (bpsTotal !== BPS_PER_WHOLE) {
  throw new Error('Invest demo allocation basis points must sum to 100%');
}
