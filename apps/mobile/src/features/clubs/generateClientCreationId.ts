export function generateClientCreationId(): string {
  return crypto.randomUUID();
}
