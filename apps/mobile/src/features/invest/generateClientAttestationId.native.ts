import { randomUUID } from 'expo-crypto';

export function generateClientAttestationId(): string {
  return randomUUID();
}
