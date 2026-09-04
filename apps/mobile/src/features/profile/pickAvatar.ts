import * as ImagePicker from 'expo-image-picker';

import { processAvatarImage } from './processAvatarImage';

export type AvatarPickResult =
  | { ok: true; uri: string }
  | { ok: false; reason: 'denied' | 'cancelled' | 'failed' };

export async function pickProcessedAvatar(): Promise<AvatarPickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, reason: 'denied' };
  }

  const selected = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (selected.canceled || !selected.assets[0]) {
    return { ok: false, reason: 'cancelled' };
  }

  const asset = selected.assets[0];
  const width = asset.width || 512;
  const height = asset.height || 512;

  try {
    const uri = await processAvatarImage(asset.uri, width, height);
    return { ok: true, uri };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
