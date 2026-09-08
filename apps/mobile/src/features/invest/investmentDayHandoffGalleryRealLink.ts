import { formatNokFromMinor } from '../../lib/currency.ts';

import { VERIFIED_NORDNET_PRODUCT_PAGE_URL } from './nordnetHandoffUrl.ts';
import {
  openInvestmentDayNordnetHandoff,
  presentAppStateHandoffReturn,
  presentHandoffCardModel,
  type BrokerHandoffListing,
  type BrokerHandoffPhase,
  type HandoffOpenResult,
  type OpenHandoffUrl,
} from './presentInvestmentDayBrokerHandoff.ts';

export type HandoffGalleryMode = 'ui_preview' | 'real_nordnet_test';

export const HANDOFF_GALLERY_MODE_OPTIONS: readonly {
  id: HandoffGalleryMode;
  label: string;
}[] = [
  { id: 'ui_preview', label: 'UI preview' },
  { id: 'real_nordnet_test', label: 'Real Nordnet test' },
];

export function presentHandoffGalleryModeCopy(mode: HandoffGalleryMode) {
  return {
    heading: 'Development handoff test',
    uiPreviewLabel: 'UI preview',
    realTestLabel: 'Real Nordnet test',
    previewNote: 'Uses the production handoff card with local fixtures only. No broker, auth, or link request is sent.',
    realTestNote: 'Opens the verified Nordnet web product page. No order is placed.',
    showRealTestNote: mode === 'real_nordnet_test',
  };
}

export function galleryHandoffSendsServerCall(_mode?: HandoffGalleryMode): false {
  return false;
}

export function galleryHandoffOpensExternalUrl(mode: HandoffGalleryMode): boolean {
  return mode === 'real_nordnet_test';
}

export function galleryRealNordnetListing(): BrokerHandoffListing {
  return {
    status: 'ready',
    broker: 'nordnet',
    fundName: 'DNB Global Indeks A',
    isin: 'NO0010582984',
    productUrl: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
    checkedOn: '2026-09-07',
    rejectedUrl: false,
  };
}

export async function performGalleryHandoffOpen(input: {
  mode: HandoffGalleryMode;
  openUrl: OpenHandoffUrl;
}): Promise<
  | { skipped: true; openedUrl: null; awaitingReturn: false; phase: 'idle' }
  | HandoffOpenResult
> {
  if (input.mode !== 'real_nordnet_test') {
    return {
      skipped: true,
      openedUrl: null,
      awaitingReturn: false,
      phase: 'idle',
    };
  }

  return openInvestmentDayNordnetHandoff({
    fetchListing: async () => galleryRealNordnetListing(),
    openUrl: input.openUrl,
  });
}

export function presentGalleryHandoffReturn(input: {
  mode: HandoffGalleryMode;
  phase: BrokerHandoffPhase;
  awaitingReturn: boolean;
  appState: string;
}): { phase: BrokerHandoffPhase; awaitingReturn: boolean } {
  if (input.mode !== 'real_nordnet_test') {
    return { phase: input.phase, awaitingReturn: false };
  }
  return presentAppStateHandoffReturn({
    phase: input.phase,
    awaitingReturn: input.awaitingReturn,
    appState: input.appState,
  });
}

export function presentGalleryReturnedCard(phase: BrokerHandoffPhase) {
  const listing = galleryRealNordnetListing();
  return presentHandoffCardModel({
    availability: 'nordnet',
    phase,
    fundName: listing.fundName,
    isin: listing.isin,
    plannedAmountLabel: formatNokFromMinor(200000),
  });
}
