export const AVATAR_STACK_MAX_VISIBLE = 3;

export function resolveAvatarContent(input: {
  imageSource?: unknown;
  failedSource?: unknown;
  overflow?: boolean;
}): 'image' | 'initials' {
  if (input.overflow) {
    return 'initials';
  }
  if (input.imageSource !== undefined && input.failedSource !== input.imageSource) {
    return 'image';
  }
  return 'initials';
}

export function splitAvatarStack<T>(people: readonly T[], maxVisible = AVATAR_STACK_MAX_VISIBLE): {
  visible: T[];
  overflowCount: number;
} {
  const visible = people.slice(0, maxVisible);
  return {
    visible,
    overflowCount: Math.max(0, people.length - visible.length),
  };
}
