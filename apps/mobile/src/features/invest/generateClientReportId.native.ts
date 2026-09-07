import { randomUUID } from 'expo-crypto';

export function generateClientReportId(): string {
  return randomUUID();
}
