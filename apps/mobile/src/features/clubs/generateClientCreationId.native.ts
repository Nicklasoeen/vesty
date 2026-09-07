import { randomUUID } from 'expo-crypto';

export function generateClientCreationId(): string {
  return randomUUID();
}
