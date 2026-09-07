import {
  createEmptyCreateClubDraft,
  type CreateClubDraft,
} from '../clubs/createClubWizard.ts';
import type { CreateClubSubmitState } from '../clubs/createClubSubmission.ts';
import {
  DNB_GLOBAL_INDEKS_A,
  DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
  type CatalogLoadState,
  type SingleFundProduct,
} from '../clubs/singleFundCatalog.ts';

export interface GroupModeGalleryScenario {
  id: string;
  label: string;
  draft: CreateClubDraft;
  products: readonly SingleFundProduct[];
  catalogState: CatalogLoadState;
  submitState: CreateClubSubmitState;
  catalogMessage?: string | null;
  submitMessage?: string | null;
  fundDetailOpen?: boolean;
  compact?: boolean;
  largeText?: boolean;
}

const CREATION_ID = '86000000-0000-4000-8000-000000000001';

const longFund: SingleFundProduct = {
  ...DNB_GLOBAL_INDEKS_A,
  id: '32000000-0000-4000-8000-000000000099',
  legalName: 'DNB Global Indeks A with an unusually long legal share-class name for stress',
  displayName: 'DNB Global Indeks A with an unusually long legal share-class name for stress',
};

const inactiveFund: SingleFundProduct = {
  ...DNB_GLOBAL_INDEKS_A,
  status: 'inactive',
};

function baseDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...createEmptyCreateClubDraft(CREATION_ID),
    name: 'Sammen hver måned',
    mode: 'single_fund',
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    contributionMode: 'equal',
    equalAmountInput: '1000',
    ...overrides,
  };
}

function scenario(
  id: string,
  label: string,
  draft: CreateClubDraft,
  overrides: Partial<Omit<GroupModeGalleryScenario, 'id' | 'label' | 'draft'>> = {},
): GroupModeGalleryScenario {
  return {
    id,
    label,
    draft,
    products: [DNB_GLOBAL_INDEKS_A],
    catalogState: 'ready',
    submitState: 'idle',
    ...overrides,
  };
}

export const GROUP_MODE_GALLERY_SCENARIOS: readonly GroupModeGalleryScenario[] = [
  scenario('name', 'Step · club name', baseDraft({ step: 'name', mode: null, catalogProductId: null })),
  scenario('mode-empty', 'Mode · unselected', baseDraft({ step: 'mode', mode: null, catalogProductId: null })),
  scenario('mode-simple', 'Mode · Simple selected', baseDraft({ step: 'mode' })),
  scenario('mode-locked', 'Mode · Build your strategy locked', baseDraft({ step: 'mode' })),
  scenario('catalog-loading', 'Catalog · loading', baseDraft({ step: 'fund' }), { catalogState: 'loading' }),
  scenario('catalog-error', 'Catalog · error', baseDraft({ step: 'fund' }), { catalogState: 'error' }),
  scenario('catalog-empty', 'Catalog · empty', baseDraft({ step: 'fund', catalogProductId: null }), {
    catalogState: 'empty',
    products: [],
  }),
  scenario('fund-deactivated', 'Fund · deactivated', baseDraft({ step: 'fund', catalogProductId: null }), {
    products: [inactiveFund],
    catalogState: 'ready',
    catalogMessage: 'This fund is no longer available for new clubs. Choose another fund to continue.',
  }),
  scenario('fund-selected', 'Fund · selected', baseDraft({ step: 'fund' })),
  scenario('fund-detail', 'Fund · details', baseDraft({ step: 'fund' }), { fundDetailOpen: true }),
  scenario('contribution-equal', 'Contribution · Equal', baseDraft({ step: 'contribution' })),
  scenario('contribution-flexible', 'Contribution · Flexible', baseDraft({
    step: 'contribution',
    contributionMode: 'flexible',
    equalAmountInput: '',
    creatorFlexibleAmountInput: '1500',
  })),
  scenario('governance', 'Step · governance', baseDraft({ step: 'governance' })),
  scenario('review', 'Review', baseDraft({ step: 'review' })),
  scenario('submit-loading', 'Submit · loading', baseDraft({ step: 'review' }), { submitState: 'loading' }),
  scenario('submit-timeout', 'Submit · timeout', baseDraft({ step: 'review' }), { submitState: 'timeout' }),
  scenario('submit-conflict', 'Submit · conflict', baseDraft({ step: 'review' }), { submitState: 'conflict' }),
  scenario('submit-idempotent', 'Submit · idempotent success', baseDraft({ step: 'review' }), {
    submitState: 'success',
    submitMessage: 'This club was already created. Opening it now.',
  }),
  scenario('submit-success', 'Submit · success', baseDraft({ step: 'review' }), { submitState: 'success' }),
  scenario(
    'long-name',
    'Stress · long club name',
    baseDraft({
      step: 'review',
      name: 'Den langsiktige investeringsklubben for familie og gode venner',
    }),
    { compact: true },
  ),
  scenario('long-fund', 'Stress · long fund name', baseDraft({
    step: 'fund',
    catalogProductId: longFund.id,
  }), { products: [longFund], compact: true, fundDetailOpen: true }),
  scenario('large-text', 'Stress · large text', baseDraft({ step: 'review' }), { compact: true, largeText: true }),
  scenario('small-iphone', 'Stress · 375 iPhone', baseDraft({ step: 'mode' }), { compact: true }),
];

export function getGroupModeGalleryScenario(id: string): GroupModeGalleryScenario {
  return GROUP_MODE_GALLERY_SCENARIOS.find((item) => item.id === id) ?? GROUP_MODE_GALLERY_SCENARIOS[0]!;
}

export function galleryFixtureSendsServerCall(_scenario: GroupModeGalleryScenario): false {
  return false;
}
