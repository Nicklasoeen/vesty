const NORDNET_HANDOFF_HOST = 'www.nordnet.no';
export const NORDNET_HANDOFF_BROKER = 'nordnet' as const;

/** Verified official product page. Gallery real-link tests use this exact URL. */
export const VERIFIED_NORDNET_PRODUCT_PAGE_URL =
  'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894';

/** Verified official monthly savings page. No member amount is included. */
export const VERIFIED_NORDNET_MONTHLY_SAVING_URL =
  'https://www.nordnet.no/monthlysavings/create';

export function isAllowedNordnetHandoffUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username !== '' || parsed.password !== '') {
      return false;
    }
    return parsed.hostname === NORDNET_HANDOFF_HOST;
  } catch {
    return false;
  }
}

export function isVerifiedNordnetMonthlySavingUrl(url: string): boolean {
  return url === VERIFIED_NORDNET_MONTHLY_SAVING_URL && isAllowedNordnetHandoffUrl(url);
}

export function isVerifiedNordnetOneTimePurchaseUrl(url: string): boolean {
  return isAllowedNordnetHandoffUrl(url);
}

export function nordnetUrlCarriesMemberAmount(url: string, amountMinor: number | null): boolean {
  if (!Number.isInteger(amountMinor) || amountMinor == null || amountMinor <= 0) {
    return false;
  }
  const haystack = url.toLowerCase();
  const minor = String(amountMinor);
  const kroner = String(Math.trunc(amountMinor / 100));
  if (haystack.includes(minor)) {
    return true;
  }
  if (kroner.length >= 3 && haystack.includes(kroner)) {
    return true;
  }
  return /(?:amount|belop|sum|qty)=/.test(haystack);
}
