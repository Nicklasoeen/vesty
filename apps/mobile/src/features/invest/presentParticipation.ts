export const PARTICIPATION_PRIVACY_INFO =
  'Members can see who has completed Investment Day, but not how much anyone invested.';

export const PARTICIPATION_REPORTING_INFO =
  'Investment status is reported by each member and is not verified by the broker.';

export const FORBIDDEN_PARTICIPATION_COPY = [
  'buying power',
  'shares per member',
  'cost per member',
  'pooled',
  'withdraw',
  'market buy',
  'winning streak',
  'perfect score',
  'letting the club down',
] as const;

export function participationFirstName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/).filter(Boolean)[0];
  return first || 'Member';
}

export function presentParticipationCount(completedCount: number, totalCount: number): string {
  return `${completedCount} of ${totalCount} invested`;
}

export function presentParticipationStreak(currentStreak: number): string | null {
  if (currentStreak <= 0) {
    return null;
  }
  return `🔥 ${currentStreak}`;
}

export function presentParticipationStatus(completed: boolean): 'Invested' | 'Pending' {
  return completed ? 'Invested' : 'Pending';
}

export function presentParticipationMember(input: {
  displayName: string | null;
  completed: boolean;
  currentStreak: number;
}): {
  firstName: string;
  statusLabel: 'Invested' | 'Pending';
  streakLabel: string | null;
  showStreak: boolean;
} {
  return {
    firstName: participationFirstName(input.displayName),
    statusLabel: presentParticipationStatus(input.completed),
    streakLabel: presentParticipationStreak(input.currentStreak),
    showStreak: input.currentStreak > 0,
  };
}

export function presentInvestmentDayParticipation(input: {
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
}): {
  title: string;
  countLabel: string;
  allCompletedTitle: string | null;
  allCompletedSubtitle: string | null;
  privacyInfo: typeof PARTICIPATION_PRIVACY_INFO;
  reportingInfo: typeof PARTICIPATION_REPORTING_INFO;
} {
  const countLabel = presentParticipationCount(input.completedCount, input.totalCount);
  return {
    title: 'Club progress',
    countLabel,
    allCompletedTitle: input.allCompleted ? 'Everyone invested 🎉' : null,
    allCompletedSubtitle: input.allCompleted ? `${input.totalCount} of ${input.totalCount} completed` : null,
    privacyInfo: PARTICIPATION_PRIVACY_INFO,
    reportingInfo: PARTICIPATION_REPORTING_INFO,
  };
}

export function presentClubOverviewParticipation(input: {
  completedCount: number;
  totalCount: number;
  allCompleted: boolean;
}): {
  countLabel: string;
  allCompletedLabel: string | null;
} {
  return {
    countLabel: presentParticipationCount(input.completedCount, input.totalCount),
    allCompletedLabel: input.allCompleted ? 'Everyone invested' : null,
  };
}

export function participationCopyContainsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PARTICIPATION_COPY.some((phrase) => lower.includes(phrase));
}

export function participationCopyContainsPrivateFinance(text: string): boolean {
  return /amount_minor|quantity|isin|unit price|execution price|\bkr\b|\bnok\b|buying power/i.test(
    text,
  );
}

export function participationShowsBrokerPreference(text: string): boolean {
  return /nordnet|firi|sparebank|open broker|preferred broker/i.test(text);
}
