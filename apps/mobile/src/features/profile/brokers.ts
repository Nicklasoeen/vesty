export const PREFERRED_BROKERS = ['nordnet', 'dnb', 'kron', 'sparebank1', 'other'] as const;

export type PreferredBroker = (typeof PREFERRED_BROKERS)[number];

const BROKER_LABELS: Record<PreferredBroker, string> = {
  nordnet: 'Nordnet',
  dnb: 'DNB',
  kron: 'Kron',
  sparebank1: 'SpareBank 1',
  other: 'Other',
};

export const BROKER_OPTIONS: readonly { value: PreferredBroker; label: string }[] = PREFERRED_BROKERS.map(
  (value) => ({ value, label: BROKER_LABELS[value] }),
);

export function isPreferredBroker(value: unknown): value is PreferredBroker {
  return typeof value === 'string' && (PREFERRED_BROKERS as readonly string[]).includes(value);
}

export function parsePreferredBroker(value: unknown): PreferredBroker | null {
  return isPreferredBroker(value) ? value : null;
}

export function preferredBrokerLabel(broker: PreferredBroker): string {
  return BROKER_LABELS[broker];
}

export function preferredBrokerSettingsValue(broker: PreferredBroker | null): string {
  return broker ? BROKER_LABELS[broker] : 'Not selected';
}

export function openBrokerActionLabel(broker: PreferredBroker): string {
  if (broker === 'other') {
    return 'Open broker';
  }
  return `Open in ${BROKER_LABELS[broker]}`;
}
