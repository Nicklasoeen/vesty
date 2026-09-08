const NORDNET_HANDOFF_HOST = 'www.nordnet.no';
export const NORDNET_HANDOFF_BROKER = 'nordnet' as const;

/** Verified official product page. Gallery real-link tests use this exact URL. */
export const VERIFIED_NORDNET_PRODUCT_PAGE_URL =
  'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894';

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
