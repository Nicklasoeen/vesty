import { CORE_V1_TARGETS } from '../clubs/curatedInvestmentPackages.ts';
import {
  INITIAL_GROUP_MODE_DRAFT,
  type CatalogState,
  type GroupModeDraft,
  type PrototypeSubmitState,
} from './groupModePrototype.ts';

export interface GroupModeGalleryScenario {
  id: string;
  label: string;
  draft: GroupModeDraft;
  catalogState: CatalogState;
  submitState: PrototypeSubmitState;
  fundDetailOpen?: boolean;
  compact?: boolean;
  largeText?: boolean;
}

const simpleDraft: GroupModeDraft = {
  ...INITIAL_GROUP_MODE_DRAFT,
  clubName: 'Sammen hver måned',
  mode: 'simple_saving',
  simpleFundSelected: true,
  brokerPreference: 'dnb',
  contributionMode: 'equal',
  equalAmountInput: '1000',
};

const customDraft: GroupModeDraft = {
  ...INITIAL_GROUP_MODE_DRAFT,
  clubName: 'Vår investeringsklubb',
  mode: 'custom_strategy',
  customAllocations: [
    { targetId: CORE_V1_TARGETS[0]!.id, percent: 60 },
    { targetId: CORE_V1_TARGETS[1]!.id, percent: 40 },
  ],
  contributionMode: 'flexible',
  flexibleAmountInput: '1500',
  governance: 'supermajority',
};

function scenario(
  id: string,
  label: string,
  draft: GroupModeDraft,
  overrides: Partial<Omit<GroupModeGalleryScenario, 'id' | 'label' | 'draft'>> = {},
): GroupModeGalleryScenario {
  return {
    id,
    label,
    draft,
    catalogState: 'ready',
    submitState: 'idle',
    ...overrides,
  };
}

export const GROUP_MODE_GALLERY_SCENARIOS: readonly GroupModeGalleryScenario[] = [
  scenario('name', 'Step · club name', { ...INITIAL_GROUP_MODE_DRAFT, step: 'name' }),
  scenario('mode-empty', 'Mode · unselected', { ...INITIAL_GROUP_MODE_DRAFT, step: 'mode', clubName: 'Sammen' }),
  scenario('mode-simple', 'Mode · Simple selected', { ...simpleDraft, step: 'mode' }),
  scenario('mode-custom', 'Mode · Strategy selected', { ...customDraft, step: 'mode' }),
  scenario('simple-normal', 'Simple · normal', { ...simpleDraft, step: 'investment' }),
  scenario('simple-detail', 'Simple · detail open', { ...simpleDraft, step: 'investment' }, { fundDetailOpen: true }),
  scenario('simple-broker-unknown', 'Simple · broker unknown', {
    ...simpleDraft,
    step: 'investment',
    brokerPreference: 'unknown',
  }),
  scenario('simple-unavailable', 'Simple · unavailable', { ...simpleDraft, step: 'investment' }, { catalogState: 'unavailable' }),
  scenario('catalog-loading', 'Catalog · loading', { ...simpleDraft, step: 'investment' }, { catalogState: 'loading' }),
  scenario('catalog-empty', 'Catalog · empty', { ...simpleDraft, step: 'investment' }, { catalogState: 'empty' }),
  scenario('catalog-error', 'Catalog · error', { ...simpleDraft, step: 'investment' }, { catalogState: 'error' }),
  scenario('custom-empty', 'Strategy · no selection', {
    ...customDraft,
    step: 'investment',
    customAllocations: [],
  }),
  scenario('custom-valid', 'Strategy · valid 100%', { ...customDraft, step: 'investment' }),
  scenario('custom-under', 'Strategy · under 100%', {
    ...customDraft,
    step: 'investment',
    customAllocations: [
      { targetId: CORE_V1_TARGETS[0]!.id, percent: 50 },
      { targetId: CORE_V1_TARGETS[1]!.id, percent: 30 },
    ],
  }),
  scenario('custom-over', 'Strategy · over 100%', {
    ...customDraft,
    step: 'investment',
    customAllocations: [
      { targetId: CORE_V1_TARGETS[0]!.id, percent: 70 },
      { targetId: CORE_V1_TARGETS[1]!.id, percent: 50 },
    ],
  }),
  scenario('contribution', 'Step · contribution', { ...simpleDraft, step: 'contribution' }),
  scenario('governance', 'Step · governance', { ...simpleDraft, step: 'governance' }),
  scenario('simple-review', 'Review · Simple', { ...simpleDraft, step: 'review' }),
  scenario('custom-review', 'Review · Strategy', { ...customDraft, step: 'review' }),
  scenario('submit-loading', 'Submit · loading', { ...simpleDraft, step: 'review' }, { submitState: 'loading' }),
  scenario('submit-error', 'Submit · error', { ...simpleDraft, step: 'review' }, { submitState: 'error' }),
  scenario('submit-success', 'Submit · success', { ...simpleDraft, step: 'review' }, { submitState: 'success' }),
  scenario(
    'long-name',
    'Stress · long name',
    {
      ...customDraft,
      step: 'review',
      clubName: 'Den langsiktige investeringsklubben for familie og gode venner',
    },
    { compact: true },
  ),
  scenario('large-text', 'Stress · large text', { ...simpleDraft, step: 'review' }, { compact: true, largeText: true }),
] as const;

export function getGroupModeGalleryScenario(id: string): GroupModeGalleryScenario {
  return GROUP_MODE_GALLERY_SCENARIOS.find((item) => item.id === id) ?? GROUP_MODE_GALLERY_SCENARIOS[0]!;
}
