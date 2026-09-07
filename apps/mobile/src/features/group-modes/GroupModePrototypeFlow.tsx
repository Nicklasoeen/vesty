import { useState } from 'react';

import { CreateClubJourney } from '@/features/clubs/CreateClubJourney';
import { createEmptyCreateClubDraft, type CreateClubDraft } from '@/features/clubs/createClubWizard';
import type { CreateClubSubmitState } from '@/features/clubs/createClubSubmission';
import { DNB_GLOBAL_INDEKS_A, type CatalogLoadState } from '@/features/clubs/singleFundCatalog';

interface GroupModePrototypeFlowProps {
  initialDraft?: CreateClubDraft;
  catalogState?: CatalogLoadState;
  submitState?: CreateClubSubmitState;
  fundDetailInitiallyOpen?: boolean;
  compact?: boolean;
  largeText?: boolean;
  onRetryCatalog?: () => void;
}

export function GroupModePrototypeFlow({
  initialDraft = createEmptyCreateClubDraft('86000000-0000-4000-8000-000000000001'),
  catalogState = 'ready',
  submitState = 'idle',
  fundDetailInitiallyOpen = false,
  compact = false,
  largeText = false,
  onRetryCatalog,
}: GroupModePrototypeFlowProps) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <CreateClubJourney
      draft={draft}
      onDraftChange={setDraft}
      products={catalogState === 'ready' ? [DNB_GLOBAL_INDEKS_A] : []}
      catalogState={catalogState}
      onRetryCatalog={onRetryCatalog}
      submitState={submitState}
      onSubmit={() => undefined}
      fundDetailOpen={fundDetailInitiallyOpen}
      compact={compact}
      largeText={largeText}
      onLeave={() => undefined}
    />
  );
}
