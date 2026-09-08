import { contributionKronerFromMinor } from '../clubs/contributionAmount.ts';
import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  isVerifiedNordnetMonthlySavingUrl,
  isVerifiedNordnetOneTimePurchaseUrl,
  nordnetUrlCarriesMemberAmount,
  NORDNET_HANDOFF_BROKER,
} from './nordnetHandoffUrl.ts';
import type { OpenHandoffUrl } from './presentInvestmentDayBrokerHandoff.ts';

export type MonthlySavingSetupStatus =
  | 'not_set_up'
  | 'current'
  | 'needs_update'
  | 'setup_required'
  | 'unavailable';

export type MonthlySavingPhase =
  | 'idle'
  | 'loading'
  | 'opened'
  | 'returned'
  | 'confirming'
  | 'error';

export type MonthlySavingView = 'monthly' | 'one_time';

export type MonthlySavingAction =
  | 'setup_monthly'
  | 'update_monthly'
  | 'check_nordnet'
  | 'buy_once'
  | 'copy_amount'
  | 'open_one_time'
  | 'report'
  | 'confirm_setup'
  | 'not_yet'
  | 'retry';

export interface MonthlySavingWriteEffects {
  writesAttestation: boolean;
  writesParticipation: false;
  writesReport: false;
  writesPurchase: false;
  brokerVerified: false;
  assumesMonthlyBuyHappened: false;
}

export interface MonthlySavingSetup {
  status: MonthlySavingSetupStatus;
  provenance: 'member_attested';
  broker: 'nordnet' | null;
  fundName: string | null;
  isin: string | null;
  recommendedAmountMinor: number | null;
  currency: string | null;
  recommendedInvestmentDayAt: string | null;
  scheduleDayOfMonth: number | null;
  monthlySetupUrl: string | null;
  oneTimeProductUrl: string | null;
  attestedAt: string | null;
  attestedAmountMinor: number | null;
  attestedFundName: string | null;
  attestedScheduleDayOfMonth: number | null;
  amountChanged: boolean;
  fundChanged: boolean;
  scheduleChanged: boolean;
  oneTimeAvailable: boolean;
  rejectedMonthlyUrl: boolean;
  rejectedOneTimeUrl: boolean;
}

export interface MonthlySavingCardModel {
  status: MonthlySavingSetupStatus;
  phase: MonthlySavingPhase;
  view: 'monthly';
  title: string;
  badge: string | null;
  body: string;
  fundName: string | null;
  amountLabel: string | null;
  scheduleLabel: string | null;
  recommended: true;
  error: boolean;
  loading: boolean;
  primary: { label: string; action: MonthlySavingAction; busy: boolean } | null;
  secondary: { label: string; action: MonthlySavingAction } | null;
  tertiary: { label: string; action: MonthlySavingAction } | null;
  disclaimer: string | null;
  writeEffects: MonthlySavingWriteEffects;
}

export interface OneTimePurchaseCardModel {
  view: 'one_time';
  title: string;
  body: string;
  fundName: string | null;
  plannedAmountLabel: string | null;
  copyAmountValue: string | null;
  primary: { label: string; action: MonthlySavingAction; busy: boolean } | null;
  secondary: { label: string; action: MonthlySavingAction } | null;
  tertiary: { label: string; action: MonthlySavingAction } | null;
  disclaimer: string | null;
  writeEffects: MonthlySavingWriteEffects;
}

const STATUSES: readonly MonthlySavingSetupStatus[] = [
  'not_set_up',
  'current',
  'needs_update',
  'setup_required',
  'unavailable',
];

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

function asNullableInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function emptySetup(): MonthlySavingSetup {
  return {
    status: 'unavailable',
    provenance: 'member_attested',
    broker: null,
    fundName: null,
    isin: null,
    recommendedAmountMinor: null,
    currency: null,
    recommendedInvestmentDayAt: null,
    scheduleDayOfMonth: null,
    monthlySetupUrl: null,
    oneTimeProductUrl: null,
    attestedAt: null,
    attestedAmountMinor: null,
    attestedFundName: null,
    attestedScheduleDayOfMonth: null,
    amountChanged: false,
    fundChanged: false,
    scheduleChanged: false,
    oneTimeAvailable: false,
    rejectedMonthlyUrl: false,
    rejectedOneTimeUrl: false,
  };
}

export function presentMonthlySavingWriteEffects(
  writesAttestation = false,
): MonthlySavingWriteEffects {
  return {
    writesAttestation,
    writesParticipation: false,
    writesReport: false,
    writesPurchase: false,
    brokerVerified: false,
    assumesMonthlyBuyHappened: false,
  };
}

export function monthlySavingIsRecommended(): true {
  return true;
}

export function oneTimePurchaseIsAlwaysOffered(): true {
  return true;
}

export function presentValidatedMonthlySavingUrl(url: string | null | undefined): string | null {
  if (!url || !isVerifiedNordnetMonthlySavingUrl(url)) {
    return null;
  }
  return url;
}

export function presentValidatedOneTimePurchaseUrl(url: string | null | undefined): string | null {
  if (!url || !isVerifiedNordnetOneTimePurchaseUrl(url)) {
    return null;
  }
  return url;
}

export function parseMonthlySavingSetup(data: unknown): MonthlySavingSetup {
  const row = firstRpcRow(data) ?? asRecord(data);
  const empty = emptySetup();
  if (!row) {
    return empty;
  }

  const statusValue = asNullableString(row.status);
  const status = STATUSES.includes(statusValue as MonthlySavingSetupStatus)
    ? (statusValue as MonthlySavingSetupStatus)
    : 'unavailable';
  const amountMinor = asNullableInteger(row.recommended_amount_minor);
  const monthlyUrl = presentValidatedMonthlySavingUrl(asNullableString(row.monthly_setup_url));
  const oneTimeUrl = presentValidatedOneTimePurchaseUrl(asNullableString(row.one_time_product_url));
  const rawMonthly = asNullableString(row.monthly_setup_url);
  const rawOneTime = asNullableString(row.one_time_product_url);

  return {
    status,
    provenance: 'member_attested',
    broker: asNullableString(row.broker) === NORDNET_HANDOFF_BROKER ? 'nordnet' : null,
    fundName: asNullableString(row.fund_name),
    isin: asNullableString(row.isin),
    recommendedAmountMinor: amountMinor,
    currency: asNullableString(row.currency),
    recommendedInvestmentDayAt: asNullableString(row.recommended_investment_day_at),
    scheduleDayOfMonth: asNullableInteger(row.schedule_day_of_month),
    monthlySetupUrl: monthlyUrl,
    oneTimeProductUrl: oneTimeUrl,
    attestedAt: asNullableString(row.attested_at),
    attestedAmountMinor: asNullableInteger(row.attested_amount_minor),
    attestedFundName: asNullableString(row.attested_fund_name),
    attestedScheduleDayOfMonth: asNullableInteger(row.attested_schedule_day_of_month),
    amountChanged: asBoolean(row.amount_changed),
    fundChanged: asBoolean(row.fund_changed),
    scheduleChanged: asBoolean(row.schedule_changed),
    oneTimeAvailable: asBoolean(row.one_time_available) && oneTimeUrl != null,
    rejectedMonthlyUrl: rawMonthly != null && monthlyUrl == null,
    rejectedOneTimeUrl: rawOneTime != null && oneTimeUrl == null,
  };
}

export function formatMonthlySavingDayLabel(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

export function formatScheduleDayOfMonth(day: number | null): string | null {
  if (!Number.isInteger(day) || day == null || day < 1 || day > 31) {
    return null;
  }
  const remainder = day % 100;
  const suffix =
    remainder >= 11 && remainder <= 13
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th';
  return `${day}${suffix} of each month`;
}

export function presentCopyAmountValue(amountMinor: number | null): string | null {
  if (amountMinor == null) {
    return null;
  }
  const kroner = contributionKronerFromMinor(amountMinor);
  return kroner === '' ? null : kroner;
}

function amountLabel(amountMinor: number | null): string | null {
  if (amountMinor == null) {
    return null;
  }
  return formatNokFromMinor(amountMinor);
}

function needsUpdateBody(setup: MonthlySavingSetup): string {
  const parts: string[] = [];
  if (setup.amountChanged) {
    const nextAmount = amountLabel(setup.recommendedAmountMinor);
    parts.push(nextAmount ? `Update the monthly amount to ${nextAmount}.` : 'Update the monthly amount in Nordnet.');
  }
  if (setup.fundChanged) {
    parts.push(
      setup.fundName
        ? `The club fund is now ${setup.fundName}.`
        : 'The club fund has changed.',
    );
  }
  if (setup.scheduleChanged) {
    const schedule = formatScheduleDayOfMonth(setup.scheduleDayOfMonth);
    parts.push(schedule ? `Investment Day moved to the ${schedule}.` : 'The Investment Day schedule has changed.');
  }
  if (parts.length === 0) {
    return 'Update the monthly saving agreement in Nordnet to match your Vesty plan.';
  }
  return parts.join(' ');
}

export function canConfirmMonthlySavingSetup(input: {
  phase: MonthlySavingPhase;
  openedMonthlyUrl: boolean;
}): boolean {
  return input.phase === 'returned' && input.openedMonthlyUrl;
}

export function presentAppStateMonthlySavingReturn(input: {
  phase: MonthlySavingPhase;
  awaitingReturn: boolean;
  appState: string;
}): { phase: MonthlySavingPhase; awaitingReturn: boolean } {
  if (input.appState !== 'active' || !input.awaitingReturn) {
    return { phase: input.phase, awaitingReturn: input.awaitingReturn };
  }
  if (input.phase !== 'opened') {
    return { phase: input.phase, awaitingReturn: false };
  }
  return { phase: 'returned', awaitingReturn: false };
}

export async function openMonthlySavingSetupUrl(input: {
  setup: MonthlySavingSetup;
  openUrl: OpenHandoffUrl;
}): Promise<{
  phase: Extract<MonthlySavingPhase, 'opened' | 'error'>;
  openedUrl: string | null;
  awaitingReturn: boolean;
  writeEffects: MonthlySavingWriteEffects;
}> {
  const writeEffects = presentMonthlySavingWriteEffects(false);
  const url = presentValidatedMonthlySavingUrl(input.setup.monthlySetupUrl);
  if (
    !url
    || nordnetUrlCarriesMemberAmount(url, input.setup.recommendedAmountMinor)
  ) {
    return { phase: 'error', openedUrl: null, awaitingReturn: false, writeEffects };
  }
  try {
    await input.openUrl(url);
    return { phase: 'opened', openedUrl: url, awaitingReturn: true, writeEffects };
  } catch {
    return { phase: 'error', openedUrl: null, awaitingReturn: false, writeEffects };
  }
}

export async function openOneTimePurchaseUrl(input: {
  setup: MonthlySavingSetup;
  openUrl: OpenHandoffUrl;
}): Promise<{
  openedUrl: string | null;
  writesMonthlyAttestation: false;
  writeEffects: MonthlySavingWriteEffects;
}> {
  const writeEffects = presentMonthlySavingWriteEffects(false);
  const url = presentValidatedOneTimePurchaseUrl(input.setup.oneTimeProductUrl);
  if (!url || nordnetUrlCarriesMemberAmount(url, input.setup.recommendedAmountMinor)) {
    return { openedUrl: null, writesMonthlyAttestation: false, writeEffects };
  }
  await input.openUrl(url);
  return { openedUrl: url, writesMonthlyAttestation: false, writeEffects };
}

export function presentMonthlySavingCardModel(input: {
  setup: MonthlySavingSetup;
  phase: MonthlySavingPhase;
}): MonthlySavingCardModel {
  const writeEffects = presentMonthlySavingWriteEffects(false);
  const amount = amountLabel(input.setup.recommendedAmountMinor);
  const attestedAmount = amountLabel(input.setup.attestedAmountMinor);
  const schedule =
    formatMonthlySavingDayLabel(input.setup.recommendedInvestmentDayAt)
    ?? formatScheduleDayOfMonth(input.setup.scheduleDayOfMonth);
  const base = {
    status: input.setup.status,
    phase: input.phase,
    view: 'monthly' as const,
    fundName: input.setup.fundName,
    recommended: true as const,
    writeEffects,
  };

  if (input.phase === 'loading' || input.phase === 'confirming') {
    return {
      ...base,
      title: input.phase === 'confirming' ? 'Saving your confirmation' : 'Opening Nordnet',
      badge: 'Recommended',
      body: 'Vesty does not place an order or send money.',
      amountLabel: amount,
      scheduleLabel: schedule,
      error: false,
      loading: true,
      primary: {
        label: input.phase === 'confirming' ? "I've set it up" : 'Set up monthly saving',
        action: input.phase === 'confirming' ? 'confirm_setup' : 'setup_monthly',
        busy: true,
      },
      secondary: null,
      tertiary: null,
      disclaimer: null,
    };
  }

  if (input.phase === 'error') {
    return {
      ...base,
      title: 'Couldn\'t open Nordnet',
      badge: null,
      body: 'Try again. Vesty does not place an order or send money.',
      amountLabel: amount,
      scheduleLabel: schedule,
      error: true,
      loading: false,
      primary: { label: 'Try again', action: 'retry', busy: false },
      secondary: { label: 'Buy once instead', action: 'buy_once' },
      tertiary: null,
      disclaimer: null,
    };
  }

  if (input.phase === 'returned') {
    return {
      ...base,
      title: 'Did you finish setting it up?',
      badge: null,
      body: 'Only “I’ve set it up” stores your confirmation in Vesty. Returning from Nordnet is not enough.',
      amountLabel: amount,
      scheduleLabel: schedule,
      error: false,
      loading: false,
      primary: { label: "I've set it up", action: 'confirm_setup', busy: false },
      secondary: { label: 'Not yet', action: 'not_yet' },
      tertiary: { label: 'Buy once instead', action: 'buy_once' },
      disclaimer: 'Vesty stores your confirmation. It does not check Nordnet or mark a purchase as done.',
    };
  }

  if (input.setup.status === 'setup_required') {
    return {
      ...base,
      title: 'Set your monthly amount',
      badge: 'Recommended',
      body: 'Add your contribution in Vesty before setting up monthly saving at Nordnet.',
      amountLabel: null,
      scheduleLabel: schedule,
      error: false,
      loading: false,
      primary: null,
      secondary: { label: 'Buy once instead', action: 'buy_once' },
      tertiary: null,
      disclaimer: null,
    };
  }

  if (input.setup.status === 'unavailable') {
    return {
      ...base,
      title: 'Monthly saving is not available',
      badge: null,
      body: 'This test version can open a Nordnet monthly saving agreement when the club fund listing is ready. One-time purchase stays available when the product page is verified.',
      amountLabel: amount,
      scheduleLabel: schedule,
      error: false,
      loading: false,
      primary: null,
      secondary: input.setup.oneTimeAvailable ? { label: 'Buy once instead', action: 'buy_once' } : null,
      tertiary: { label: 'Report what happened', action: 'report' },
      disclaimer: null,
    };
  }

  if (input.setup.status === 'needs_update') {
    return {
      ...base,
      title: 'Your Vesty plan has changed',
      badge: 'Recommended',
      body: needsUpdateBody(input.setup),
      amountLabel: amount,
      scheduleLabel: schedule,
      error: false,
      loading: false,
      primary: { label: 'Update monthly saving', action: 'update_monthly', busy: false },
      secondary: { label: 'Buy once this month', action: 'buy_once' },
      tertiary: null,
      disclaimer: 'Update the agreement in Nordnet, then confirm in Vesty. Vesty does not change Nordnet for you.',
    };
  }

  if (input.setup.status === 'current') {
    return {
      ...base,
      title: 'Monthly saving set up',
      badge: null,
      body: 'You confirmed this setup in Vesty. Nordnet has not verified it.',
      amountLabel: attestedAmount ?? amount,
      scheduleLabel: formatScheduleDayOfMonth(input.setup.attestedScheduleDayOfMonth) ?? schedule,
      error: false,
      loading: false,
      primary: { label: 'Check in Nordnet', action: 'check_nordnet', busy: false },
      secondary: { label: 'Buy once instead', action: 'buy_once' },
      tertiary: { label: 'Report what happened', action: 'report' },
      disclaimer: 'This is your confirmation, not a broker-verified agreement.',
    };
  }

  return {
    ...base,
    title: 'Monthly saving',
    badge: 'Recommended',
    body: 'Create the monthly saving agreement yourself at Nordnet. Vesty only stores your confirmation.',
    amountLabel: amount,
    scheduleLabel: schedule,
    error: false,
    loading: false,
    primary: { label: 'Set up monthly saving', action: 'setup_monthly', busy: false },
    secondary: { label: 'Buy once instead', action: 'buy_once' },
    tertiary: null,
    disclaimer: 'Vesty does not place an order, send money, or assume a monthly buy happened.',
  };
}

export function presentOneTimePurchaseCardModel(setup: MonthlySavingSetup): OneTimePurchaseCardModel {
  const amount = amountLabel(setup.recommendedAmountMinor);
  return {
    view: 'one_time',
    title: 'One-time purchase',
    body: 'Open the fund in Nordnet and buy once. This is not stored as a monthly saving agreement.',
    fundName: setup.fundName,
    plannedAmountLabel: amount,
    copyAmountValue: presentCopyAmountValue(setup.recommendedAmountMinor),
    primary: setup.oneTimeProductUrl
      ? { label: 'Open in Nordnet', action: 'open_one_time', busy: false }
      : null,
    secondary: presentCopyAmountValue(setup.recommendedAmountMinor)
      ? { label: 'Copy amount', action: 'copy_amount' }
      : null,
    tertiary: { label: 'Report what happened', action: 'report' },
    disclaimer: 'A one-time purchase never saves a monthly saving setup.',
    writeEffects: presentMonthlySavingWriteEffects(false),
  };
}

export function presentMonthlySavingWorkbench(input: {
  setup: MonthlySavingSetup;
  phase: MonthlySavingPhase;
  view: MonthlySavingView;
}): {
  surface: MonthlySavingView;
  monthly: MonthlySavingCardModel;
  oneTime: OneTimePurchaseCardModel;
  monthlySavingRecommended: true;
  oneTimeAlwaysAvailable: true;
} {
  return {
    surface: input.view,
    monthly: presentMonthlySavingCardModel({ setup: input.setup, phase: input.phase }),
    oneTime: presentOneTimePurchaseCardModel(input.setup),
    monthlySavingRecommended: true,
    oneTimeAlwaysAvailable: true,
  };
}
