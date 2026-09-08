import { Linking } from 'react-native';

/**
 * Production and the isolated real-link gallery share this open path.
 * Callers must pass a URL that has already been allowlisted.
 */
export async function openNordnetHandoffUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
