import { presentCreateClubProgress } from '../clubs/presentCreateClub.ts';
import { presentCreateClubReviewAgreement, presentGroupTypeOptions } from '../clubs/presentSingleFund.ts';
import { DNB_GLOBAL_INDEKS_A } from '../clubs/singleFundCatalog.ts';
import type { CreateClubDraft } from '../clubs/createClubWizard.ts';

export function presentGroupModeStep(step: CreateClubDraft['step']) {
  return presentCreateClubProgress(step);
}

export function presentGroupModeOptions(selected: CreateClubDraft['mode']) {
  return presentGroupTypeOptions(selected);
}

export function presentPrototypeReview(draft: CreateClubDraft) {
  return presentCreateClubReviewAgreement(draft, DNB_GLOBAL_INDEKS_A);
}
