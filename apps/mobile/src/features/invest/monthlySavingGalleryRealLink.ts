import {
  VERIFIED_NORDNET_MONTHLY_SAVING_URL,
  VERIFIED_NORDNET_PRODUCT_PAGE_URL,
} from './nordnetHandoffUrl.ts';
import {
  openMonthlySavingSetupUrl,
  presentAppStateMonthlySavingReturn,
  presentMonthlySavingCardModel,
  type MonthlySavingPhase,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup.ts';
import type { OpenHandoffUrl } from './presentInvestmentDayBrokerHandoff.ts';

export type MonthlySavingGalleryMode = 'ui_preview' | 'real_nordnet_test';

export const MONTHLY_SAVING_GALLERY_MODE_OPTIONS: readonly {
  id: MonthlySavingGalleryMode;
  label: string;
}[] = [
  { id: 'ui_preview', label: 'UI preview' },
  { id: 'real_nordnet_test', label: 'Real Nordnet test' },
];

export function presentMonthlySavingGalleryModeCopy(mode: MonthlySavingGalleryMode) {
  return {
    heading: 'Development monthly saving test',
    previewNote: 'Uses the production Invest journey with local fixtures only. No broker, auth, or link request is sent.',
    realTestNote: 'Opens the verified Nordnet monthly savings page. No order is placed and no attestation is stored.',
    showRealTestNote: mode === 'real_nordnet_test',
  };
}

export function galleryMonthlySavingSendsServerCall(_mode?: MonthlySavingGalleryMode): false {
  return false;
}

export function galleryMonthlySavingOpensExternalUrl(mode: MonthlySavingGalleryMode): boolean {
  return mode === 'real_nordnet_test';
}

export function galleryRealMonthlySavingSetup(): MonthlySavingSetup {
  return {
    status: 'not_set_up',
    provenance: 'member_attested',
    broker: 'nordnet',
    fundName: 'DNB Global Indeks A',
    isin: 'NO0010582984',
    recommendedAmountMinor: 200000,
    currency: 'NOK',
    recommendedInvestmentDayAt: '2026-10-05T10:00:00.000Z',
    scheduleDayOfMonth: 5,
    monthlySetupUrl: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
    oneTimeProductUrl: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
    attestedAt: null,
    attestedAmountMinor: null,
    attestedFundName: null,
    attestedScheduleDayOfMonth: null,
    amountChanged: false,
    fundChanged: false,
    scheduleChanged: false,
    oneTimeAvailable: true,
    rejectedMonthlyUrl: false,
    rejectedOneTimeUrl: false,
  };
}

export async function performGalleryMonthlySavingOpen(input: {
  mode: MonthlySavingGalleryMode;
  openUrl: OpenHandoffUrl;
}): Promise<
  | { skipped: true; openedUrl: null; awaitingReturn: false; phase: 'idle' }
  | { skipped?: false; phase: MonthlySavingPhase; openedUrl: string | null; awaitingReturn: boolean }
> {
  if (input.mode !== 'real_nordnet_test') {
    return {
      skipped: true,
      openedUrl: null,
      awaitingReturn: false,
      phase: 'idle',
    };
  }

  return openMonthlySavingSetupUrl({
    setup: galleryRealMonthlySavingSetup(),
    openUrl: input.openUrl,
  });
}

export function presentGalleryMonthlySavingReturn(input: {
  mode: MonthlySavingGalleryMode;
  phase: MonthlySavingPhase;
  awaitingReturn: boolean;
  appState: string;
}): { phase: MonthlySavingPhase; awaitingReturn: boolean } {
  if (input.mode !== 'real_nordnet_test') {
    return { phase: input.phase, awaitingReturn: false };
  }
  return presentAppStateMonthlySavingReturn({
    phase: input.phase,
    awaitingReturn: input.awaitingReturn,
    appState: input.appState,
  });
}

export function presentGalleryReturnedMonthlyCard(phase: MonthlySavingPhase) {
  return presentMonthlySavingCardModel({
    setup: galleryRealMonthlySavingSetup(),
    phase,
  });
}
