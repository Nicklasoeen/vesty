import { formatNokFromMinor } from '../../lib/currency.ts';

import type { InvestmentDayReportChoice } from './investmentDayReport.ts';
import {
  presentInvestDayHero,
  type InvestJourneySurface,
} from './presentInvestJourney.ts';
import type { MonthlySavingSetup } from './presentMonthlySavingSetup.ts';
import type { InvestmentDayPlan } from './types.ts';

export interface InvestJourneyCopy {
  eyebrow: string;
  titleLead: string;
  titleEmphasis: string;
  body: string;
  privacy: string | null;
  alert: string | null;
  primaryLabel: string | null;
  secondaryLabel: string | null;
  tertiaryLabel: string | null;
  checkboxLabel: string | null;
  note: string | null;
}

export function presentInvestIntroCopy() {
  return {
    eyebrow: 'Your next small step',
    titleLead: 'Small steps.',
    titleEmphasis: 'A lasting habit.',
    body: 'Make room for your future.\nOne shared rhythm. Your own investment.',
    startLabel: 'Find your saving rhythm',
  };
}

export function presentInvestChooseCopy() {
  return {
    eyebrow: 'Your saving rhythm',
    titleLead: 'A little today.',
    titleEmphasis: 'More often.',
    body: 'Choose how you want to invest. You can always make a one-time purchase.',
    monthlyTitle: 'Monthly saving',
    monthlyBody: 'One fund. A regular habit.\nSet it up once in Nordnet. Vesty does not create or verify the agreement.',
    monthlyBadge: 'Recommended',
    onceTitle: 'Buy once',
    onceBody: 'Your amount. Your timing.\nMake a one-time purchase.',
    privacy: 'Your choice, broker and amount stay private.',
  };
}

export function presentInvestSetupCopy(isUpdate: boolean) {
  return {
    eyebrow: isUpdate ? 'Update monthly saving' : 'Your monthly saving plan',
    titleLead: isUpdate ? 'Bring your plan' : 'Your plan.',
    titleEmphasis: isUpdate ? 'up to date.' : 'On repeat.',
    body: isUpdate
      ? 'Make these changes to your existing monthly saving in Nordnet. Vesty has not changed the Nordnet agreement.'
      : 'Use these details to set up monthly saving in Nordnet.',
    stepOne: isUpdate
      ? 'Open Nordnet and update monthly saving for this fund.'
      : 'Open Nordnet and configure monthly saving for this fund.',
    stepTwo: 'Return to Vesty and confirm only after completing it.',
    note: 'The date is your preference. Nordnet determines when the order is executed.',
    primaryLabel: isUpdate ? 'Open Nordnet to update monthly saving' : 'Open Nordnet',
    secondaryLabel: isUpdate ? 'Buy once this month' : 'Buy once instead',
  };
}

export function presentInvestReturnedCopy(isUpdate: boolean) {
  return {
    eyebrow: 'Confirm monthly saving',
    titleLead: isUpdate ? 'All updated?' : 'Made it',
    titleEmphasis: isUpdate ? '' : 'a habit?',
    body: isUpdate
      ? 'Confirm only after updating your agreement in Nordnet.'
      : 'Confirm only after completing your monthly saving setup in Nordnet.',
    checkboxLabel: isUpdate
      ? "I've updated monthly saving with these details in Nordnet."
      : "I've set up monthly saving with these details in Nordnet.",
    note: "This is your confirmation. Vesty cannot verify the broker agreement or confirm a purchase.",
    primaryLabel: isUpdate ? "I've updated it" : "I've set it up",
    secondaryLabel: 'Not yet',
  };
}

export function presentInvestOpeningCopy(kind: 'monthly' | 'one_time') {
  return {
    eyebrow: 'Nordnet',
    titleLead: 'Over to',
    titleEmphasis: 'Nordnet.',
    body: kind === 'monthly'
      ? 'Complete monthly saving in Nordnet, then return to Vesty.'
      : 'Open the fund in Nordnet, review the order yourself, then return to Vesty.',
    stepOne: kind === 'monthly'
      ? 'Set up or update monthly saving.'
      : 'Open the fund and review your one-time order.',
    stepTwo: 'Check the details in Nordnet before confirming anything in Vesty.',
    note: 'Opening Nordnet never records a purchase in Vesty.',
  };
}

export function presentInvestSavedCopy(isUpdate: boolean) {
  return {
    eyebrow: 'Your confirmation saved',
    titleLead: 'A good habit.',
    titleEmphasis: 'Ready to begin.',
    body: 'On your next Investment Day, we will ask whether your monthly saving went through.',
    monthlyLabel: isUpdate ? 'Update confirmed by you' : 'Setup confirmed by you',
    purchasesLabel: 'None from this setup',
    privacy: 'Your group sees Ready. Your broker, amount and setup stay private.',
    primaryLabel: 'Done',
  };
}

export function presentInvestCurrentCopy(clubName: string | null) {
  return {
    eyebrow: clubName ?? 'Invest',
    titleLead: 'One less thing',
    titleEmphasis: 'to remember.',
    body: 'Monthly saving confirmed by you.',
    nextLabel: 'Next Investment Day',
    nextBody: 'We will check in about your purchase then.',
    note: 'Vesty has not verified your agreement or recorded a purchase.',
    primaryLabel: 'Check in Nordnet',
    secondaryLabel: 'Buy once',
  };
}

export function presentInvestNeedsUpdateCopy() {
  return {
    eyebrow: 'Action needed',
    titleLead: 'Your plan',
    titleEmphasis: 'has changed.',
    body: 'Update your monthly saving in Nordnet to match your Vesty plan.',
    alert: 'Vesty has not changed your agreement in Nordnet. Review your existing agreement before making another purchase.',
    primaryLabel: 'Open Nordnet to update monthly saving',
    secondaryLabel: 'Buy once this month',
  };
}

export function presentInvestSetupRequiredCopy() {
  return {
    eyebrow: 'Contribution needed',
    titleLead: 'Set your',
    titleEmphasis: 'monthly amount.',
    body: 'Add your contribution in Vesty before setting up monthly saving at Nordnet. Vesty will not invent an amount.',
    primaryLabel: null,
    note: 'After you save an amount, return here to continue.',
  };
}

export function presentInvestUnavailableCopy() {
  return {
    eyebrow: 'Monthly saving',
    titleLead: 'Not available',
    titleEmphasis: 'just yet.',
    body: 'Monthly saving cannot be set up for this club right now. A one-time purchase stays available when the fund page is ready.',
    secondaryLabel: 'Buy once instead',
  };
}

export function presentInvestOneTimeCopy() {
  return {
    eyebrow: 'One-time purchase',
    titleLead: 'This month.',
    titleEmphasis: 'Your way.',
    body: 'Buy in your own Nordnet account. Opening Nordnet never creates a purchase or report.',
    amountLabel: 'Planned amount',
    stepOne: 'Copy the amount and open the fund in Nordnet.',
    stepTwo: 'Review and place the order yourself.',
    note: 'Opening Nordnet never records a purchase in Vesty. A one-time purchase never saves a monthly saving setup.',
    primaryLabel: 'Open in Nordnet',
    secondaryLabel: 'Copy amount',
    tertiaryLabel: 'Back',
  };
}

export function presentInvestOneTimeOutsideWindowCopy() {
  return {
    eyebrow: 'Welcome back',
    titleLead: 'Not recorded',
    titleEmphasis: 'yet.',
    body: 'Vesty did not record a purchase. You can check and report this during the relevant Investment Day.',
    alert: 'Reporting is not open right now, so there is no submit action that would fail.',
    note: 'Opening Nordnet never creates a purchase or report.',
    primaryLabel: 'Done',
    secondaryLabel: 'Buy once again',
  };
}

export function presentInvestLoadErrorCopy(message: string | null) {
  return {
    eyebrow: 'Something went wrong',
    titleLead: "Let's try",
    titleEmphasis: 'that again.',
    body: message ?? 'Unable to load your saving plan.',
    primaryLabel: 'Try again',
    finderHint: 'Use Try again to reload this screen.',
  };
}

export function presentInvestAttestationTimeoutCopy() {
  return {
    eyebrow: 'Response uncertain',
    titleLead: "We couldn't",
    titleEmphasis: 'confirm the response.',
    body: 'Vesty could not confirm whether this confirmation was received. Retry uses the same confirmation and will not create a second one.',
    primaryLabel: 'Retry confirmation',
    secondaryLabel: 'Not yet',
  };
}

export function presentInvestAttestationErrorCopy() {
  return {
    eyebrow: 'Unable to save',
    titleLead: 'This confirmation',
    titleEmphasis: 'did not save.',
    body: 'Unable to save this monthly saving confirmation. Your confirmation is still here. Try again.',
    primaryLabel: 'Try again',
    secondaryLabel: 'Not yet',
  };
}

export function presentInvestAttestationConflictCopy() {
  return {
    eyebrow: 'Confirmation already saved',
    titleLead: 'This one',
    titleEmphasis: 'does not match.',
    body: 'This monthly saving confirmation was already saved with different details.',
    primaryLabel: 'Back',
  };
}

export function presentInvestNoClubCopy() {
  return {
    eyebrow: 'Invest',
    titleLead: 'Start with',
    titleEmphasis: 'a club.',
    body: 'Create or join a club to set up monthly saving and record an Investment Day.',
  };
}

export function presentInvestLoadingCopy() {
  return {
    eyebrow: 'Invest',
    titleLead: 'Loading',
    titleEmphasis: 'your plan.',
    body: 'Fetching your monthly saving setup.',
  };
}

export function presentInvestOpeningErrorCopy() {
  return {
    eyebrow: 'Nordnet',
    titleLead: "Couldn't open",
    titleEmphasis: 'Nordnet.',
    body: 'Try again. Vesty does not place an order or send money.',
    primaryLabel: 'Try again',
    secondaryLabel: 'Buy once instead',
  };
}

export function presentInvestInvestmentDayOpenCopy(plan: InvestmentDayPlan | null, setup: MonthlySavingSetup | null) {
  const hero = presentInvestDayHero(plan?.investmentDayAt ?? setup?.recommendedInvestmentDayAt ?? null);
  const dateLabel = hero ? `${hero.day} ${hero.month}` : 'Investment Day';
  return {
    eyebrow: `${dateLabel} · Investment Day`,
    titleLead: 'Same rhythm.',
    titleEmphasis: 'A fresh check-in.',
    body: 'Did your monthly saving go through?',
    plannedLabel: 'Your planned purchase',
    note: 'Check the completed order in Nordnet before reporting. Other members see participation status only.',
  };
}

export function presentInvestUpcomingCopy() {
  return {
    titleLead: 'One less thing',
    titleEmphasis: 'to remember.',
    body: 'Your monthly saving setup is confirmed by you. Reporting has not opened yet.',
  };
}

export function presentInvestClosedCopy() {
  return {
    titleLead: 'Reporting',
    titleEmphasis: 'has closed.',
    body: 'The reporting window has closed. A late report cannot be saved for this Investment Day.',
  };
}

export function presentInvestReviewCopy(choice: InvestmentDayReportChoice) {
  if (choice === 'skipped') {
    return {
      eyebrow: 'This Investment Day',
      titleLead: "It's okay",
      titleEmphasis: 'to sit one out.',
      body: 'Confirm that you did not make a purchase this time.',
      privacy: 'No purchase will be added. Your monthly saving setup is not changed. Your reason stays private.',
      primaryLabel: 'Confirm no purchase',
      sourceLabel: 'Your confirmation · not broker-verified',
    };
  }
  return {
    eyebrow: 'Confirm your report',
    titleLead: 'A check-in.',
    titleEmphasis: 'From you.',
    body: choice === 'with_changes'
      ? 'You are reporting the amount you actually bought.'
      : 'You are confirming that your purchase matched the plan.',
    privacy: 'Your group sees your check-in status, never the amount or differences from the plan.',
    primaryLabel: 'Confirm purchase report',
    sourceLabel: 'Your confirmation · not broker-verified',
  };
}

export function presentInvestPendingCopy() {
  return {
    eyebrow: 'Not completed yet',
    titleLead: 'Give it',
    titleEmphasis: 'a little time.',
    body: 'Come back when Nordnet shows a completed purchase. A submitted order is not a completed investment.',
    privacy: 'No purchase recorded. This selection does not send an investment report.',
    primaryLabel: 'Back to Investment Day',
  };
}

export function presentInvestReportSavedCopy(outcome: string, amountMinor: number | null, fundName: string | null) {
  const skipped = outcome === 'skipped' || outcome === 'failed';
  return {
    eyebrow: 'Check-in saved',
    titleLead: skipped ? 'All caught up.' : 'Another step.',
    titleEmphasis: skipped ? '' : 'At your pace.',
    body: skipped
      ? 'You reported no purchase for this Investment Day.'
      : 'Your purchase report has been saved.',
    amountLabel: skipped || amountMinor == null ? null : `${formatNokFromMinor(amountMinor)} · confirmed by you`,
    fundName,
    note: 'This is your report. Vesty has not verified a transaction with Nordnet.',
    primaryLabel: 'Done',
  };
}

export function presentInvestJourneyCopy(surface: InvestJourneySurface): Pick<
  InvestJourneyCopy,
  'eyebrow' | 'titleLead' | 'titleEmphasis' | 'body'
> {
  switch (surface) {
    case 'intro':
      return presentInvestIntroCopy();
    case 'choose':
      return presentInvestChooseCopy();
    case 'setup':
      return presentInvestSetupCopy(false);
    case 'needs_update':
      return presentInvestNeedsUpdateCopy();
    case 'returned':
      return presentInvestReturnedCopy(false);
    case 'opening_nordnet':
      return presentInvestOpeningCopy('monthly');
    case 'one_time_opening':
      return presentInvestOpeningCopy('one_time');
    case 'attestation_saved':
      return presentInvestSavedCopy(false);
    case 'current':
    case 'investment_day_upcoming':
      return presentInvestCurrentCopy(null);
    case 'setup_required':
      return presentInvestSetupRequiredCopy();
    case 'unavailable':
      return presentInvestUnavailableCopy();
    case 'one_time':
      return presentInvestOneTimeCopy();
    case 'one_time_returned_outside_window':
      return presentInvestOneTimeOutsideWindowCopy();
    case 'request_error':
      return presentInvestLoadErrorCopy(null);
    case 'attestation_timeout':
      return presentInvestAttestationTimeoutCopy();
    case 'attestation_error':
      return presentInvestAttestationErrorCopy();
    case 'no_club':
      return presentInvestNoClubCopy();
    case 'loading':
      return presentInvestLoadingCopy();
    default:
      return presentInvestCurrentCopy(null);
  }
}
