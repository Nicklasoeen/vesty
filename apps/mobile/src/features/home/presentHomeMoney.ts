/**
 * Home display formatting only. Stored minor units / bps stay exact.
 * Do not feed these strings back into calculations.
 */

const KRONER_PER_MILLION = 1_000_000;
const KRONER_PER_BILLION = 1_000_000_000;

const wholeKronerFormatter = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function signPrefix(amount: number): string {
  if (amount > 0) {
    return '+';
  }
  if (amount < 0) {
    return '\u2212';
  }
  return '';
}

function formatCompactMagnitude(value: number): string {
  return compactFormatter.format(value);
}

/**
 * Whole-kroner Home figure. Extreme magnitudes use Norwegian mill./mrd.
 */
export function formatHomeNokFromMinor(amountMinor: number): string {
  const kroner = Math.abs(amountMinor) / 100;
  if (kroner >= KRONER_PER_BILLION) {
    return `${formatCompactMagnitude(kroner / KRONER_PER_BILLION)} mrd. kr`;
  }
  if (kroner >= KRONER_PER_MILLION) {
    return `${formatCompactMagnitude(kroner / KRONER_PER_MILLION)} mill. kr`;
  }
  return `${wholeKronerFormatter.format(Math.trunc(kroner))} kr`;
}

export function formatHomeNok(amountKroner: number): string {
  return formatHomeNokFromMinor(Math.trunc(amountKroner) * 100);
}

export function formatHomeSignedNokFromMinor(amountMinor: number): string {
  return `${signPrefix(amountMinor)}${formatHomeNokFromMinor(amountMinor)}`;
}

export function formatHomeSignedPercentage(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${signPrefix(value)}${formatCompactMagnitude(abs / 1_000_000)} mill. %`;
  }
  if (abs >= 1_000) {
    return `${signPrefix(value)}${wholeKronerFormatter.format(Math.round(abs))}%`;
  }
  return `${signPrefix(value)}${abs.toFixed(1)}%`;
}

export function formatHomeSignedBps(bps: number): string {
  return formatHomeSignedPercentage(bps / 100);
}

export function formatHomeGainLine(gainLossMinor: number, gainLossBps: number): string {
  return `${formatHomeSignedNokFromMinor(gainLossMinor)} (${formatHomeSignedBps(gainLossBps)})`;
}

export const HOME_PORTFOLIO_STAT_LABELS = ['Total invested', 'Your return', 'Active clubs'] as const;
export const HOME_PINNED_STAT_LABELS = ['Group value', 'Your stake', 'All-time return'] as const;

export const HOME_SCROLL_CLEARANCE_EXTRA = 64;

export function homeScrollBottomPadding(navHeight: number, safeBottom: number): number {
  return navHeight + safeBottom + HOME_SCROLL_CLEARANCE_EXTRA;
}

export function pinnedClubStackSpacing(visibleMemberCount: number): {
  marginTop: number;
  marginBottom: number;
} {
  if (visibleMemberCount <= 1) {
    return { marginTop: 8, marginBottom: 8 };
  }
  return { marginTop: 12, marginBottom: 10 };
}
