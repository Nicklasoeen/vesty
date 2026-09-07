import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { HomeNextInvestmentDay } from '@/features/home/HomeNextInvestmentDay';
import { HomePerformanceChart } from '@/features/home/HomePerformanceChart';
import { presentInvestmentDayHeading, formatInvestmentDayWhen, presentInvestmentDayPlannedMinor } from '@/features/home/presentInvestmentDay';
import { presentClubContributionSummary, presentContributionPolicyTiming } from '@/features/clubs/presentContribution';
import { useClubContribution } from '@/features/clubs/useClubContribution';
import { useClubStrategy } from '@/features/clubs/useClubStrategy';
import { asAmountProvenance } from '@/features/invest/amountProvenance';
import { presentClubOverviewParticipation } from '@/features/invest/presentParticipation';
import { useInvestmentDay } from '@/features/invest/useInvestmentDay';
import { useInvestmentDayParticipation } from '@/features/invest/useInvestmentDayParticipation';
import { historyByRange } from '@/features/portfolio/buildPortfolioChartSeries';
import type { EstimatedPosition, MemberPortfolioSummary, PortfolioHistoryPoint } from '@/features/portfolio/portfolioApi';
import { ESTIMATED_VALUATION_INFO, portfolioValueCaption } from '@/features/portfolio/valuationLabels';
import { formatHomeNokFromMinor, formatHomeSignedPercentage } from '@/features/home/presentHomeMoney';
import { useTheme } from '@/theme';
import { AllocationBar, AppText, Button, InvestmentIdentity, SectionHeader, Surface } from '@/ui';

import {
  CLUB_HOLDINGS_TITLE,
  CLUB_PERFORMANCE_CAPTION,
  CLUB_PERFORMANCE_TITLE,
  CLUB_STRATEGY_TITLE,
  presentClubHoldingCard,
  presentClubHoldingsCaption,
  presentClubStrategy,
  presentClubViewerFinance,
} from './presentClubDashboard';

interface ClubOverviewProps {
  clubId: string;
  investmentMode?: 'legacy_package' | 'single_fund' | 'custom_portfolio';
  summary: MemberPortfolioSummary | null;
  history: PortfolioHistoryPoint[];
  positions: EstimatedPosition[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenInvest: () => void;
}

export function ClubOverview({
  clubId,
  investmentMode,
  summary,
  history,
  positions,
  isLoading,
  error,
  onRetry,
  onOpenInvest,
}: ClubOverviewProps) {
  const { colors, radius, spacing } = useTheme();
  const { allocations } = useClubStrategy(clubId);
  const contribution = useClubContribution(clubId);
  const investmentDay = useInvestmentDay(clubId);
  const contributionSummary = contribution.policy
    ? presentClubContributionSummary(contribution.policy)
    : null;
  const contributionTiming =
    contribution.policy?.mode === 'equal'
      ? presentContributionPolicyTiming({
          mode: 'equal',
          policyAmountMinor: contribution.policy.equalAmountMinor,
          frozenCycleAmountMinor: investmentDay.plan?.expectedAmountMinor ?? null,
        })
      : { appliesCopy: null };
  const participation = useInvestmentDayParticipation(clubId, investmentDay.plan?.cycleId ?? null);
  const compactParticipation = participation.participation
    ? presentClubOverviewParticipation({
        completedCount: participation.participation.completedCount,
        totalCount: participation.participation.totalCount,
        allCompleted: participation.participation.allCompleted,
      })
    : null;
  const finance = presentClubViewerFinance(summary);
  const strategy = presentClubStrategy(allocations, investmentMode);
  const chartHistory = historyByRange(history);
  const hasChart = finance.presentation === 'estimated' && chartHistory.ALL.length >= 2;
  const returnColor =
    finance.returnPercentage != null && finance.returnPercentage < 0 ? 'negative' : 'positive';
  const confidenceCaption =
    finance.valuationConfidence != null ? portfolioValueCaption(finance.valuationConfidence) : null;
  const holdingsCaption = presentClubHoldingsCaption(finance.valuationConfidence);

  return (
    <View>
      <View style={{ marginBottom: spacing.lg }}>
        <SectionHeader title={CLUB_PERFORMANCE_TITLE} style={{ marginBottom: 6 }} />
        {isLoading ? (
          <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <ActivityIndicator accessibilityLabel="Loading club portfolio" color={colors.accent} />
          </View>
        ) : error ? (
          <View>
            <AppText variant="supporting">{error}</AppText>
            <View style={{ marginTop: spacing.md }}>
              <Button label="Try again" variant="secondary" onPress={onRetry} />
            </View>
          </View>
        ) : finance.presentation === 'estimated' && finance.yourStakeMinor != null ? (
          <>
            <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {formatHomeNokFromMinor(finance.yourStakeMinor)}
            </AppText>
            {finance.returnPercentage != null ? (
              <AppText variant="value" color={returnColor} style={{ marginTop: 1 }}>
                {formatHomeSignedPercentage(finance.returnPercentage)}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 1 }}>
              <AppText variant="supporting">{CLUB_PERFORMANCE_CAPTION}</AppText>
              {confidenceCaption ? (
                <>
                  <AppText variant="supporting">{'  ·  '}</AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${confidenceCaption}. ${ESTIMATED_VALUATION_INFO}`}
                    onPress={() => Alert.alert(confidenceCaption, ESTIMATED_VALUATION_INFO)}
                    hitSlop={6}
                  >
                    <AppText variant="supporting">{confidenceCaption}</AppText>
                  </Pressable>
                </>
              ) : null}
            </View>
            {hasChart ? (
              <View style={{ marginTop: 6 }}>
                <HomePerformanceChart
                  historyByRange={chartHistory}
                  defaultRange="3M"
                  performanceColor="mint"
                  rangeVariant="segmented"
                  chartHeight={72}
                  compactLegend
                  valueLegendLabel="Estimated value"
                />
              </View>
            ) : null}
          </>
        ) : finance.investedMinor === 0 ? (
          <AppText variant="supporting">No reported investments yet.</AppText>
        ) : (
          <View>
            <AppText variant="bodyStrong">Value unavailable</AppText>
            {finance.investedMinor !== null ? (
              <AppText variant="supporting" style={{ marginTop: 2 }}>
                {`Reported invested: ${formatHomeNokFromMinor(finance.investedMinor)}`}
              </AppText>
            ) : (
              <AppText variant="supporting" style={{ marginTop: 2 }}>
                Performance for this club is unavailable.
              </AppText>
            )}
          </View>
        )}
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <HomeNextInvestmentDay
          title={presentInvestmentDayHeading({
            setupRequired: investmentDay.setupRequired,
            viewerState: investmentDay.plan?.viewerState ?? null,
            cycleStatus: investmentDay.plan?.cycleStatus ?? null,
            investmentDayAt: investmentDay.plan?.investmentDayAt ?? null,
          })}
          dateLabel={
            investmentDay.setupRequired
              ? 'Set your contribution'
              : investmentDay.plan?.viewerState === 'setup_next'
                ? 'Applies from your next Investment Day'
                : investmentDay.plan
                  ? formatInvestmentDayWhen(investmentDay.plan.reportingOpensAt ?? investmentDay.plan.investmentDayAt)
                : investmentDay.error
                  ? 'Date unavailable'
                  : 'Loading…'
          }
          plannedMinor={presentInvestmentDayPlannedMinor({
            viewerState: investmentDay.plan?.viewerState,
            setupRequired: investmentDay.setupRequired,
            expectedAmountMinor: investmentDay.plan?.expectedAmountMinor,
          })}
          setupRequired={investmentDay.setupRequired}
          participationLabel={compactParticipation?.allCompletedLabel ?? compactParticipation?.countLabel}
          participants={participation.participation?.members.map((member) => ({
            id: member.membershipId,
            initials: member.initials,
            imageSource: member.imageSource,
            completed: member.completed,
          }))}
          onPress={onOpenInvest}
        />
      </View>

      {contributionSummary ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title={contributionSummary.title} />
          <AppText variant="subtitle">{contributionSummary.styleLabel}</AppText>
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {contributionSummary.detail}
          </AppText>
          {contributionTiming.appliesCopy ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {contributionTiming.appliesCopy}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {allocations.length > 0 ? (
        <View style={{ marginBottom: spacing.lg }}>
          <SectionHeader title={CLUB_STRATEGY_TITLE} />
          {strategy.packageName ? (
            <AppText variant="subtitle">{strategy.packageName}</AppText>
          ) : null}
          {strategy.description ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {strategy.description}
            </AppText>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <AllocationBar allocations={allocations} showLegend={false} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            {strategy.lines.map((line) => (
              <View
                key={`${line.ticker}-${line.percentage}`}
                accessible
                accessibilityLabel={`${line.ticker}, ${line.friendlyName}, ${line.percentage} percent`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: 40,
                  paddingVertical: spacing.xs,
                }}
              >
                <InvestmentIdentity
                  ticker={line.ticker}
                  friendlyName={line.friendlyName}
                  markKey={line.markKey}
                  fallbackInitials={line.fallbackInitials}
                  size={34}
                  markOnly
                />
                <View style={{ flex: 1, minWidth: 0, marginLeft: spacing.sm }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {investmentMode === 'single_fund' ? line.friendlyName : line.ticker}
                  </AppText>
                  <AppText variant="supporting" numberOfLines={1}>
                    {investmentMode === 'single_fund' ? 'Simple saving · one fund' : line.friendlyName}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{`${line.percentage}%`}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {positions.length === 0 && !summary ? null : (
      <View style={{ marginBottom: spacing.sm }}>
        <SectionHeader title={CLUB_HOLDINGS_TITLE} />
        {positions.length > 0 && holdingsCaption ? (
          <AppText variant="supporting" style={{ marginTop: -spacing.xs, marginBottom: spacing.sm }}>
            {holdingsCaption}
          </AppText>
        ) : null}
        {positions.length === 0 ? (
          <AppText variant="supporting">No holdings yet.</AppText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
          >
            {positions.map((position) => {
              const card = presentClubHoldingCard({
                ticker: position.ticker,
                name: position.name,
                targetId: position.investmentTargetId,
                investedMinor: position.totalInvestedMinor,
                currentValueMinor: position.estimatedCurrentValueMinor,
                quantityStatus: position.quantityStatus,
                amountProvenance: asAmountProvenance(position.amountProvenance),
              });

              return (
                <Surface
                  key={position.investmentTargetId}
                  bordered
                  elevated
                  style={{
                    width: 168,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.xl,
                  }}
                >
                  <View accessible accessibilityLabel={card.accessibilityLabel}>
                  <InvestmentIdentity
                    ticker={card.identity.ticker}
                    friendlyName={card.identity.friendlyName}
                    markKey={card.identity.markKey}
                    fallbackInitials={card.identity.fallbackInitials}
                    size={36}
                    markOnly
                  />
                  <AppText variant="bodyStrong" numberOfLines={1} style={{ marginTop: 6 }}>
                    {card.identity.ticker}
                  </AppText>
                  <AppText variant="supporting" numberOfLines={1}>
                    {card.identity.friendlyName}
                  </AppText>
                  {card.currentValue ? (
                    <>
                      <AppText
                        variant="subtitle"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{ marginTop: 6 }}
                      >
                        {card.currentValue}
                      </AppText>
                      <AppText variant="statLabel" style={{ marginTop: 1 }}>
                        {card.currentValueCaption}
                      </AppText>
                    </>
                  ) : null}
                  <AppText variant="supporting" style={{ marginTop: 6 }}>
                    {card.investedLabel}
                  </AppText>
                  {card.cardStatus ? (
                    <AppText variant="supporting" style={{ marginTop: 2 }}>
                      {card.cardStatus}
                    </AppText>
                  ) : null}
                  </View>
                </Surface>
              );
            })}
          </ScrollView>
        )}
      </View>
      )}
    </View>
  );
}
