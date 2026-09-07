const ALLOWED_SINGLE_FUND_SOURCE_HOSTS = new Set(['www.dnb.no', 'www.nordnet.no']);

export function isAllowedSingleFundSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username !== '' || parsed.password !== '') {
      return false;
    }
    return ALLOWED_SINGLE_FUND_SOURCE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
