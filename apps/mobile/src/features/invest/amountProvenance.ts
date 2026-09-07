import { formatNokFromMinor } from '../../lib/currency.ts';

export const AMOUNT_PROVENANCE = [
  'member_attested_plan',
  'member_reported_actual',
  'legacy_plan_assumed',
  'broker_verified',
  'mixed',
] as const;

export type AmountProvenance = (typeof AMOUNT_PROVENANCE)[number];

export function asAmountProvenance(value: unknown): AmountProvenance | null {
  if (typeof value !== 'string') {
    return null;
  }
  return (AMOUNT_PROVENANCE as readonly string[]).includes(value)
    ? (value as AmountProvenance)
    : null;
}

export function presentReportedAmountLabel(
  amountMinor: number,
  provenance: AmountProvenance | string | null | undefined,
): string {
  const amount = formatNokFromMinor(amountMinor);
  if (provenance === 'legacy_plan_assumed') {
    return `${amount} planned (assumed)`;
  }
  if (provenance === 'member_attested_plan') {
    return `${amount} attested plan`;
  }
  if (provenance === 'broker_verified') {
    return `${amount} verified`;
  }
  if (provenance === 'member_reported_actual') {
    return `${amount} reported`;
  }
  if (provenance === 'mixed') {
    return `${amount} mixed basis`;
  }
  return `${amount} unverified`;
}

export function presentAmountProvenanceCaption(
  provenance: AmountProvenance | null | undefined,
): string | null {
  if (provenance === 'legacy_plan_assumed') {
    return 'This amount was assumed from an older planned report. It is not a verified purchase.';
  }
  if (provenance === 'member_attested_plan') {
    return 'You attested that this matched the frozen plan. It is not broker-verified.';
  }
  if (provenance === 'member_reported_actual') {
    return 'You reported this actual amount. It is not broker-verified.';
  }
  if (provenance === 'mixed') {
    return 'These amounts mix planned and reported figures. They are not broker-verified.';
  }
  return null;
}
