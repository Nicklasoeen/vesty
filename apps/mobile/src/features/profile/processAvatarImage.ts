import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const AVATAR_SIZE = 512;

/**
 * Square cover crop to 512×512 JPEG. Caller deletes nothing in the repo;
 * manipulator output is a temporary file URI.
 */
export async function processAvatarImage(uri: string, width: number, height: number): Promise<string> {
  const side = Math.min(width, height);
  const originX = Math.max(0, Math.round((width - side) / 2));
  const originY = Math.max(0, Math.round((height - side) / 2));

  const actions =
    width === height
      ? [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }]
      : [
          { crop: { originX, originY, width: side, height: side } },
          { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
        ];

  const result = await manipulateAsync(uri, actions, {
    compress: 0.82,
    format: SaveFormat.JPEG,
  });

  return result.uri;
}
