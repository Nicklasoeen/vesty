export const AVATARS_BUCKET = 'avatars';
export const AVATAR_OBJECT_NAME = 'avatar.jpg';
export const AVATAR_SIGNED_URL_SECONDS = 60 * 60;

export function ownAvatarPath(userId: string): string {
  return `${userId}/${AVATAR_OBJECT_NAME}`;
}
