import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

const CORE_V1_TARGET_ID_SET = new Set<string>(Object.values(CORE_V1_TARGET_IDS));

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,19})(\.\d{1,8})?$/;
const EXECUTION_PRICE_PATTERN = /^(0|[1-9]\d{0,11})(\.\d{1,8})?$/;

export type InvestmentDayConfirmationMode = 'quantity_required' | 'amount_only';

export interface ExecutionReportInput {
  investmentTargetId: string;
  quantity: string;
  executionUnitPrice?: string;
}

export interface QuantityFieldState {
  raw: string;
  error: string | null;
  canonical: string | null;
}

export function confirmationModeForTargetIds(
  targetIds: readonly string[],
): InvestmentDayConfirmationMode {
  if (targetIds.length === 0) {
    return 'amount_only';
  }

  return targetIds.every((id) => CORE_V1_TARGET_ID_SET.has(id))
    ? 'quantity_required'
    : 'amount_only';
}

export function parsePositiveDecimalInput(
  raw: string,
  pattern: RegExp,
  emptyMessage: string,
): { ok: true; canonical: string } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') {
    return { ok: false, error: emptyMessage };
  }

  if (trimmed.includes('e') || trimmed.includes('E') || trimmed.startsWith('-')) {
    return { ok: false, error: 'Enter a positive number of units' };
  }

  if (!pattern.test(trimmed)) {
    return { ok: false, error: 'Enter a positive number with up to 8 decimals' };
  }

  const [integerPart = '0'] = trimmed.split('.');
  const numericInteger = integerPart.replace(/^0+(?=\d)/, '');
  if (numericInteger === '0' && !trimmed.includes('.')) {
    return { ok: false, error: 'Enter a positive number of units' };
  }

  if (/^0+(\.0+)?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a positive number of units' };
  }

  return { ok: true, canonical: trimmed };
}

export function parseQuantityInput(raw: string): QuantityFieldState {
  const parsed = parsePositiveDecimalInput(
    raw,
    QUANTITY_PATTERN,
    'Enter the number of units you purchased',
  );
  if (!parsed.ok) {
    return { raw, error: parsed.error, canonical: null };
  }

  return { raw, error: null, canonical: parsed.canonical };
}

export function parseOptionalExecutionPriceInput(raw: string): QuantityFieldState {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { raw, error: null, canonical: null };
  }

  const parsed = parsePositiveDecimalInput(
    raw,
    EXECUTION_PRICE_PATTERN,
    'Enter a positive execution price',
  );
  if (!parsed.ok) {
    return {
      raw,
      error: parsed.error === 'Enter a positive number of units'
        ? 'Enter a positive execution price'
        : parsed.error,
      canonical: null,
    };
  }

  return { raw, error: null, canonical: parsed.canonical };
}

export function quantityFieldFromRaw(raw: string | undefined): QuantityFieldState {
  return {
    raw: raw ?? '',
    error: null,
    canonical: null,
  };
}

export function canConfirmQuantityReports(
  targetIds: readonly string[],
  fields: Readonly<Record<string, QuantityFieldState>>,
  priceFields?: Readonly<Record<string, QuantityFieldState>>,
): boolean {
  if (targetIds.length === 0) {
    return false;
  }

  return targetIds.every((id) => {
    const quantity = fields[id];
    if (!quantity || quantity.canonical === null || quantity.error) {
      return false;
    }

    const price = priceFields?.[id];
    if (!price) {
      return true;
    }

    return price.error === null;
  });
}

export function buildExecutionReports(
  targetIds: readonly string[],
  fields: Readonly<Record<string, QuantityFieldState>>,
  priceFields?: Readonly<Record<string, QuantityFieldState>>,
): ExecutionReportInput[] {
  return targetIds.map((investmentTargetId) => {
    const quantity = fields[investmentTargetId]?.canonical;
    if (!quantity) {
      throw new Error('Quantity is required');
    }

    const executionUnitPrice = priceFields?.[investmentTargetId]?.canonical;
    return executionUnitPrice
      ? { investmentTargetId, quantity, executionUnitPrice }
      : { investmentTargetId, quantity };
  });
}
