import type { PreferredBroker } from '../profile/brokers.ts';

import { isAllowedNordnetHandoffUrl, NORDNET_HANDOFF_BROKER } from './nordnetHandoffUrl.ts';

export type BrokerHandoffPhase = 'idle' | 'loading' | 'opened' | 'returned' | 'error' | 'unavailable';

export type BrokerHandoffAvailability = 'nordnet' | 'other' | 'missing';

export type HandoffCardAction = 'open' | 'open_again' | 'retry' | 'report' | 'choose_broker';

export type OpenHandoffUrl = (url: string) => Promise<void>;

export interface BrokerHandoffListing {
  status: 'ready' | 'unavailable';
  broker: 'nordnet' | null;
  fundName: string | null;
  isin: string | null;
  productUrl: string | null;
  checkedOn: string | null;
  rejectedUrl: boolean;
}

export interface HandoffWriteEffects {
  writesParticipation: false;
  writesReport: false;
  writesPurchase: false;
  confirmsBuy: false;
  marksCompletedOnReturn: false;
}

export interface HandoffOpenResult {
  phase: Extract<BrokerHandoffPhase, 'opened' | 'error' | 'unavailable'>;
  listing: BrokerHandoffListing | null;
  openedUrl: string | null;
  awaitingReturn: boolean;
  writeEffects: HandoffWriteEffects;
}

export interface HandoffCardModel {
  availability: BrokerHandoffAvailability;
  phase: BrokerHandoffPhase;
  title: string;
  body: string;
  fundName: string | null;
  isin: string | null;
  plannedAmountLabel: string | null;
  showPlannedAmount: boolean;
  welcomeBack: boolean;
  error: boolean;
  loading: boolean;
  listingUnavailable: boolean;
  primary: { label: string; action: HandoffCardAction; busy: boolean } | null;
  secondary: { label: string; action: HandoffCardAction } | null;
  manualHelp: string | null;
  disclaimer: string | null;
  canReportWithoutOpening: true;
  writeEffects: HandoffWriteEffects;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstRpcRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    return asRecord(data[0] ?? null);
  }
  return asRecord(data);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function presentBrokerHandoffAvailability(
  preferredBroker: PreferredBroker | null,
): BrokerHandoffAvailability {
  if (preferredBroker === NORDNET_HANDOFF_BROKER) {
    return 'nordnet';
  }
  if (preferredBroker == null) {
    return 'missing';
  }
  return 'other';
}

export function presentHandoffWriteEffects(): HandoffWriteEffects {
  return {
    writesParticipation: false,
    writesReport: false,
    writesPurchase: false,
    confirmsBuy: false,
    marksCompletedOnReturn: false,
  };
}

export function canReportWithoutOpeningHandoff(): true {
  return true;
}

export function presentValidatedHandoffUrl(url: string | null | undefined): string | null {
  if (!url || !isAllowedNordnetHandoffUrl(url)) {
    return null;
  }
  return url;
}

export function presentManualHandoffHelp(fundName: string | null, isin: string | null): string | null {
  const parts = [fundName, isin].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function parseBrokerHandoffListing(data: unknown): BrokerHandoffListing {
  const row = firstRpcRow(data) ?? asRecord(data);
  const empty: BrokerHandoffListing = {
    status: 'unavailable',
    broker: null,
    fundName: null,
    isin: null,
    productUrl: null,
    checkedOn: null,
    rejectedUrl: false,
  };

  if (!row) {
    return empty;
  }

  const fundName = asNullableString(row.fund_name);
  const isin = asNullableString(row.isin);
  const checkedOn = asNullableString(row.checked_on);
  const rawUrl = asNullableString(row.product_url);

  if (row.status === 'ready') {
    const productUrl = presentValidatedHandoffUrl(rawUrl);
    if (!productUrl) {
      return {
        status: 'unavailable',
        broker: null,
        fundName,
        isin,
        productUrl: null,
        checkedOn: null,
        rejectedUrl: true,
      };
    }
    return {
      status: 'ready',
      broker: NORDNET_HANDOFF_BROKER,
      fundName,
      isin,
      productUrl,
      checkedOn,
      rejectedUrl: false,
    };
  }

  return {
    status: 'unavailable',
    broker: null,
    fundName,
    isin,
    productUrl: null,
    checkedOn: null,
    rejectedUrl: false,
  };
}

export async function openInvestmentDayNordnetHandoff(input: {
  fetchListing: () => Promise<BrokerHandoffListing>;
  openUrl: OpenHandoffUrl;
}): Promise<HandoffOpenResult> {
  const writeEffects = presentHandoffWriteEffects();
  try {
    const listing = await input.fetchListing();
    if (listing.rejectedUrl) {
      return {
        phase: 'error',
        listing,
        openedUrl: null,
        awaitingReturn: false,
        writeEffects,
      };
    }
    const url = presentValidatedHandoffUrl(listing.productUrl);
    if (listing.status !== 'ready' || !url) {
      return {
        phase: 'unavailable',
        listing,
        openedUrl: null,
        awaitingReturn: false,
        writeEffects,
      };
    }
    await input.openUrl(url);
    return {
      phase: 'opened',
      listing: { ...listing, productUrl: url },
      openedUrl: url,
      awaitingReturn: true,
      writeEffects,
    };
  } catch {
    return {
      phase: 'error',
      listing: null,
      openedUrl: null,
      awaitingReturn: false,
      writeEffects,
    };
  }
}

export function presentAppStateHandoffReturn(input: {
  phase: BrokerHandoffPhase;
  awaitingReturn: boolean;
  appState: string;
}): { phase: BrokerHandoffPhase; awaitingReturn: boolean } {
  if (input.appState !== 'active' || !input.awaitingReturn) {
    return { phase: input.phase, awaitingReturn: input.awaitingReturn };
  }
  if (input.phase !== 'opened') {
    return { phase: input.phase, awaitingReturn: false };
  }
  return { phase: 'returned', awaitingReturn: false };
}

export function presentHandoffRetryPhase(phase: BrokerHandoffPhase): BrokerHandoffPhase {
  if (phase === 'error' || phase === 'unavailable') {
    return 'idle';
  }
  return phase;
}

export function presentHandoffCardModel(input: {
  availability: BrokerHandoffAvailability;
  phase: BrokerHandoffPhase;
  fundName: string | null;
  isin: string | null;
  plannedAmountLabel: string;
}): HandoffCardModel {
  const writeEffects = presentHandoffWriteEffects();
  const manualHelp = presentManualHandoffHelp(input.fundName, input.isin);
  const base = {
    availability: input.availability,
    phase: input.phase,
    fundName: input.fundName,
    isin: input.isin,
    plannedAmountLabel: input.plannedAmountLabel,
    canReportWithoutOpening: true as const,
    writeEffects,
  };

  if (input.availability === 'missing') {
    return {
      ...base,
      title: 'Choose a broker to continue',
      body: 'Select Nordnet to open the fund from Vesty. You can still report a skip without a broker.',
      showPlannedAmount: false,
      welcomeBack: false,
      error: false,
      loading: false,
      listingUnavailable: false,
      primary: { label: 'Choose broker', action: 'choose_broker', busy: false },
      secondary: { label: 'Report this Investment Day', action: 'report' },
      manualHelp: null,
      disclaimer: null,
    };
  }

  if (input.availability === 'other') {
    return {
      ...base,
      title: 'Direct handoff is available for Nordnet',
      body: 'This test version can open Nordnet for you. You can still choose another broker in settings, or report this Investment Day without opening one.',
      showPlannedAmount: true,
      welcomeBack: false,
      error: false,
      loading: false,
      listingUnavailable: false,
      primary: { label: 'Choose broker', action: 'choose_broker', busy: false },
      secondary: { label: 'Report this Investment Day', action: 'report' },
      manualHelp: null,
      disclaimer: null,
    };
  }

  if (input.phase === 'returned') {
    return {
      ...base,
      title: 'Welcome back',
      body: 'Report what actually happened. Opening Nordnet does not mark this Investment Day as done.',
      showPlannedAmount: true,
      welcomeBack: true,
      error: false,
      loading: false,
      listingUnavailable: false,
      primary: { label: 'Report what happened', action: 'report', busy: false },
      secondary: { label: 'Open Nordnet again', action: 'open_again' },
      manualHelp,
      disclaimer: 'Nordnet may open in the Nordnet app or in a browser.',
    };
  }

  if (input.phase === 'error') {
    return {
      ...base,
      title: 'Unable to open Nordnet',
      body: 'Vesty could not open the verified Nordnet page. Nothing was recorded.',
      showPlannedAmount: true,
      welcomeBack: false,
      error: true,
      loading: false,
      listingUnavailable: false,
      primary: { label: 'Try again', action: 'retry', busy: false },
      secondary: { label: 'Report this Investment Day', action: 'report' },
      manualHelp,
      disclaimer: null,
    };
  }

  if (input.phase === 'unavailable') {
    return {
      ...base,
      title: 'Nordnet is not available for this fund yet',
      body: 'Vesty does not have a verified Nordnet page for this Investment Day. You can still report what happened.',
      showPlannedAmount: true,
      welcomeBack: false,
      error: false,
      loading: false,
      listingUnavailable: true,
      primary: { label: 'Report this Investment Day', action: 'report', busy: false },
      secondary: { label: 'Choose broker', action: 'choose_broker' },
      manualHelp,
      disclaimer: null,
    };
  }

  const loading = input.phase === 'loading';
  return {
    ...base,
    title: 'Buy in your Nordnet account',
    body: 'You buy this fund in your own Nordnet account. Vesty does not send money or place the order. Enter the amount at Nordnet.',
    showPlannedAmount: true,
    welcomeBack: false,
    error: false,
    loading,
    listingUnavailable: false,
    primary: {
      label: loading ? 'Opening Nordnet' : 'Open in Nordnet',
      action: 'open',
      busy: loading,
    },
    secondary: { label: 'Report this Investment Day', action: 'report' },
    manualHelp,
    disclaimer: 'Nordnet may open in the Nordnet app or in a browser.',
  };
}
