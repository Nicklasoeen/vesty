/**
 * DEMO DATA — leftover Invest visual spike only.
 *
 * The live Invest screen reads member-reported plans from Supabase.
 * This file is not the source of truth for Investment Day completion.
 * Amounts are pre-computed integer NOK kroner, not øre.
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
  targets: readonly InvestTargetDemo[];
}

export const investPlanDemo: InvestPlanDemo = {
  clubName: 'WRIC',
  investmentDayLabel: '5 October',
  investmentDayShortLabel: '5 Oct',
  memberAmountNok: 2_000,
  currency: 'NOK',
  targets: [
    { id: 'klp-global', label: 'KLP AksjeGlobal Indeks P', allocationBps: 4_000, amountNok: 800 },
    { id: 'dnb-teknologi', label: 'DNB Teknologi A', allocationBps: 3_000, amountNok: 600 },
    { id: 'klp-norge', label: 'KLP AksjeNorge Indeks P', allocationBps: 1_500, amountNok: 300 },
    { id: 'klp-em', label: 'KLP AksjeFremvoksende Markeder Indeks P', allocationBps: 1_500, amountNok: 300 },
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
