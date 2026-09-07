import { formatNokFromMinor } from '../../lib/currency.ts';
import { presentSelectableOptionAppearance } from '../../ui/selectableOptionAppearance.ts';
import { governanceLabel } from '../clubs/governance.ts';
import { contributionStyleLabel } from '../clubs/presentContribution.ts';
import {
  GROUP_MODE_STEPS,
  STOREBRAND_FUND_CANDIDATE,
  findPrototypeTarget,
  groupModeStepIndex,
  validateCustomAllocations,
  type BrokerPreference,
  type GroupMode,
  type GroupModeDraft,
} from './groupModePrototype.ts';

const STEP_COPY = {
  name: ['Club name', 'What should your club be called?'],
  mode: ['How do you want to invest?', 'Choose the routine that fits your group.'],
  investment: ['Choose investments', 'Make the shared investment choice.'],
  contribution: ['Monthly contribution', 'Choose how members contribute.'],
  governance: ['How decisions are made', 'Choose how future proposals pass.'],
  review: ['Review', 'Confirm what your group has chosen.'],
} as const;

export function presentGroupModeStep(step: GroupModeDraft['step']) {
  const [title, supporting] = STEP_COPY[step];
  return {
    eyebrow: 'Create club · visual prototype',
    title,
    supporting,
    progressLabel: `${groupModeStepIndex(step) + 1} of ${GROUP_MODE_STEPS.length}`,
  };
}

export function presentGroupModeOptions(selected: GroupMode | null) {
  return [
    {
      value: 'simple_saving' as const,
      title: 'Simple saving',
      description: 'Choose one fund and build a regular investing habit together.',
      facts: ['One investment', 'Minimal monthly upkeep', 'Ready-made fund choices'],
      expanded: 'Each member owns and buys the fund in their own brokerage account.',
      ...presentSelectableOptionAppearance(selected === 'simple_saving'),
    },
    {
      value: 'custom_strategy' as const,
      title: 'Build your strategy',
      description: 'Choose investments together and decide how the club should be allocated.',
      facts: ['Choose several investments', 'Set target percentages', 'More decisions on Investment Day'],
      expanded: 'Availability and required steps can differ between brokers.',
      ...presentSelectableOptionAppearance(selected === 'custom_strategy'),
    },
  ];
}

export function presentFundBroker(preference: BrokerPreference) {
  if (preference === 'dnb') {
    return {
      label: 'DNB',
      cost: STOREBRAND_FUND_CANDIDATE.costs.dnb,
      availability: 'Verified public product listing: purchase supported; minimum 100 kr.',
    };
  }
  if (preference === 'nordnet') {
    return {
      label: 'Nordnet',
      cost: STOREBRAND_FUND_CANDIDATE.costs.nordnet,
      availability: 'Verified public product listing: purchase and monthly saving shown.',
    };
  }
  return {
    label: 'Broker not selected',
    cost: 'Choose a broker to see the checked platform price.',
    availability: 'Confirm the exact share class and ISIN with your broker before investing.',
  };
}

export function presentCustomAllocation(draft: GroupModeDraft) {
  const validation = validateCustomAllocations(draft.customAllocations);
  const rows = draft.customAllocations.map((allocation) => {
    const target = findPrototypeTarget(allocation.targetId);
    return {
      ...allocation,
      ticker: target.ticker,
      name: target.exposureLabel,
      detail: `${target.kind.toUpperCase()} · ${target.exchange} · ${target.currency}`,
    };
  });
  return {
    ...validation,
    rows,
    selectedCountLabel: `${rows.length} of 5 selected`,
    executionNote:
      'Small monthly amounts, whole ETF units, broker fees or broker availability can make the target percentages difficult to follow exactly.',
  };
}

export function presentPrototypeReview(draft: GroupModeDraft) {
  const amountInput =
    draft.contributionMode === 'equal' ? draft.equalAmountInput : draft.flexibleAmountInput;
  const parsedAmount = /^\d+$/.test(amountInput) ? Number(amountInput) * 100 : null;
  const investment =
    draft.mode === 'simple_saving'
      ? {
          title: STOREBRAND_FUND_CANDIDATE.friendlyName,
          detail: `One monthly purchase in ${STOREBRAND_FUND_CANDIDATE.legalName}.`,
          lines: [STOREBRAND_FUND_CANDIDATE.isin, STOREBRAND_FUND_CANDIDATE.candidateNotice],
        }
      : {
          title: `${draft.customAllocations.length} investments`,
          detail: 'Each member follows the shared target allocation when making their own purchases.',
          lines: draft.customAllocations.map((allocation) => {
            const target = findPrototypeTarget(allocation.targetId);
            return `${allocation.percent}% ${target.ticker} · ${target.exposureLabel}`;
          }),
        };

  return {
    clubName: draft.clubName.trim(),
    groupType: draft.mode === 'simple_saving' ? 'Simple saving' : 'Build your strategy',
    investment,
    contribution: {
      title: draft.contributionMode ? contributionStyleLabel(draft.contributionMode) : 'Not selected',
      detail: parsedAmount == null ? 'No amount selected' : `${formatNokFromMinor(parsedAmount)} per month`,
      privacy:
        draft.contributionMode === 'flexible'
          ? 'Each amount is private to that member.'
          : 'The shared contribution amount is visible to members.',
    },
    governance: governanceLabel(draft.governance),
    ownership: 'Each member buys and owns their investments in their own brokerage account.',
    prototypeNotice: 'Visual prototype only. This review cannot create a real club.',
  };
}
