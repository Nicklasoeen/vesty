import { supabase } from '@/lib/supabase/client';

import { mapInvestError } from './investErrors';
import {
  parseMonthlySavingSetup,
  presentMonthlySavingWriteEffects,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup';

function throwMapped(error: unknown, fallback: string, context: string): never {
  throw new Error(mapInvestError(error, fallback, context));
}

export async function fetchMonthlySavingSetup(clubId: string): Promise<MonthlySavingSetup> {
  const result = await supabase.rpc('monthly_saving_setup_v1', {
    p_club_id: clubId,
  });
  if (result.error) {
    throwMapped(result.error, 'Unable to load monthly saving', 'monthly_saving_setup_v1');
  }
  return parseMonthlySavingSetup(result.data);
}

export async function confirmMonthlySavingSetup(input: {
  clubId: string;
  clientAttestationId: string;
}): Promise<MonthlySavingSetup> {
  const result = await supabase.rpc('confirm_monthly_saving_setup_v1', {
    p_club_id: input.clubId,
    p_client_attestation_id: input.clientAttestationId,
  });
  if (result.error) {
    throwMapped(
      result.error,
      'Unable to save monthly saving confirmation',
      'confirm_monthly_saving_setup_v1',
    );
  }
  return parseMonthlySavingSetup(result.data);
}

export async function endMonthlySavingSetup(clubId: string): Promise<MonthlySavingSetup> {
  const result = await supabase.rpc('end_monthly_saving_setup_v1', {
    p_club_id: clubId,
  });
  if (result.error) {
    throwMapped(result.error, 'Unable to end monthly saving setup', 'end_monthly_saving_setup_v1');
  }
  return parseMonthlySavingSetup(result.data);
}

export function monthlySavingConfirmWriteEffects() {
  return presentMonthlySavingWriteEffects(true);
}
