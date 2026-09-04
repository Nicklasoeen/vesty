export const DISPLAY_NAME_MAX_LENGTH = 80;

export function normalizeDisplayName(value: string): string {
  return value.trim();
}

export function isDisplayNameComplete(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function validateDisplayName(value: string): string | null {
  const name = normalizeDisplayName(value);
  if (!name) {
    return 'Enter your name';
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return 'Name is too long';
  }
  return null;
}
