import { supabase } from '@/lib/supabase/client';

import { mapInvestError } from './investErrors';
import { NORDNET_HANDOFF_BROKER } from './nordnetHandoffUrl';
import {
  openInvestmentDayNordnetHandoff,
  parseBrokerHandoffListing,
  type BrokerHandoffListing,
  type HandoffOpenResult,
  type OpenHandoffUrl,
} from './presentInvestmentDayBrokerHandoff';

export async function fetchInvestmentDayBrokerHandoff(input: {
  clubId: string;
  cycleId: string;
}): Promise<BrokerHandoffListing> {
  const result = await supabase.rpc('investment_day_broker_handoff_v1', {
    p_club_id: input.clubId,
    p_cycle_id: input.cycleId,
    p_broker: NORDNET_HANDOFF_BROKER,
  });

  if (result.error) {
    throw new Error(
      mapInvestError(result.error, 'Unable to open Nordnet', 'investment_day_broker_handoff_v1'),
    );
  }

  return parseBrokerHandoffListing(result.data);
}

export async function performInvestmentDayNordnetHandoff(input: {
  clubId: string;
  cycleId: string;
  openUrl: OpenHandoffUrl;
  fetchListing?: (input: { clubId: string; cycleId: string }) => Promise<BrokerHandoffListing>;
}): Promise<HandoffOpenResult> {
  const fetchListing = input.fetchListing ?? fetchInvestmentDayBrokerHandoff;
  return openInvestmentDayNordnetHandoff({
    fetchListing: () => fetchListing({ clubId: input.clubId, cycleId: input.cycleId }),
    openUrl: input.openUrl,
  });
}
