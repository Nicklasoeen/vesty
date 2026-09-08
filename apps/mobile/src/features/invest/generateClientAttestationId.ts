export function generateClientAttestationId(): string {
  return crypto.randomUUID();
}
