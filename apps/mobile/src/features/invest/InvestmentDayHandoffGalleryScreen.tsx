import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Screen, Surface } from '@/ui';

import { InvestmentDayBrokerHandoffCard } from './InvestmentDayBrokerHandoffCard';
import {
  getInvestmentDayHandoffGalleryScenario,
  INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS,
} from './investmentDayHandoffGalleryFixtures';
import {
  galleryRealNordnetListing,
  HANDOFF_GALLERY_MODE_OPTIONS,
  presentHandoffGalleryModeCopy,
  type HandoffGalleryMode,
} from './investmentDayHandoffGalleryRealLink';
import { useGalleryRealNordnetHandoff } from './useGalleryRealNordnetHandoff';

/**
 * Development-only gallery. Isolated from auth and Supabase.
 * UI preview never opens a URL. Real Nordnet test uses the production
 * Linking path with the verified HTTPS product page.
 */
export function InvestmentDayHandoffGalleryScreen() {
  const { colors, spacing } = useTheme();
  const [mode, setMode] = useState<HandoffGalleryMode>('ui_preview');
  const copy = presentHandoffGalleryModeCopy(mode);

  return (
    <Screen
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Surface
        bordered
        style={{
          padding: spacing.md,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label">{copy.heading}</AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingTop: spacing.md,
          }}
        >
          {HANDOFF_GALLERY_MODE_OPTIONS.map((item) => {
            const active = item.id === mode;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(item.id)}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.mintSoft : colors.surface,
                }}
              >
                <AppText variant="meta">{item.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        {copy.showRealTestNote ? (
          <AppText variant="supporting" style={{ marginTop: spacing.md }}>
            {copy.realTestNote}
          </AppText>
        ) : (
          <AppText variant="supporting" style={{ marginTop: spacing.md }}>
            {copy.previewNote}
          </AppText>
        )}
      </Surface>

      {mode === 'ui_preview' ? <GalleryUiPreview /> : <GalleryRealNordnetTest />}
    </Screen>
  );
}

function GalleryUiPreview() {
  const { colors, spacing } = useTheme();
  const [scenarioId, setScenarioId] = useState(INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS[0]!.id);
  const [localAction, setLocalAction] = useState(0);
  const scenario = getInvestmentDayHandoffGalleryScenario(scenarioId);
  const noteLocalAction = () => setLocalAction((count) => count + 1);

  return (
    <View>
      <Surface
        bordered
        style={{
          padding: spacing.md,
          marginBottom: spacing.lg,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label">Development state gallery</AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.md }}
        >
          {INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS.map((item) => {
            const active = item.id === scenario.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setScenarioId(item.id);
                  setLocalAction(0);
                }}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.mintSoft : colors.surface,
                }}
              >
                <AppText variant="meta">{item.label}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {localAction > 0 ? (
          <AppText variant="meta" color="positive" style={{ marginTop: spacing.sm }}>
            {`Local action received (${localAction}). No server or link call.`}
          </AppText>
        ) : null}
      </Surface>

      <View
        style={{
          maxWidth: scenario.largeText ? 288 : 375,
          alignSelf: 'center',
          width: '100%',
          transform: scenario.largeText ? [{ scale: 1.3 }] : undefined,
          transformOrigin: scenario.largeText ? 'top center' : undefined,
          marginTop: scenario.largeText ? spacing.xl : undefined,
          marginBottom: scenario.largeText ? spacing.xxl : undefined,
        }}
      >
        <InvestmentDayBrokerHandoffCard
          availability={scenario.availability}
          phase={scenario.phase}
          fundName={scenario.fundName}
          isin={scenario.isin}
          plannedAmountLabel={scenario.plannedAmountLabel}
          onOpen={noteLocalAction}
          onOpenAgain={noteLocalAction}
          onRetry={noteLocalAction}
          onReport={noteLocalAction}
          onChooseBroker={noteLocalAction}
        />
      </View>
    </View>
  );
}

function GalleryRealNordnetTest() {
  const { spacing } = useTheme();
  const listing = galleryRealNordnetListing();
  const ready = getInvestmentDayHandoffGalleryScenario('ready');
  const handoff = useGalleryRealNordnetHandoff();
  const [localAction, setLocalAction] = useState(0);
  const noteLocalAction = () => setLocalAction((count) => count + 1);

  return (
    <View style={{ maxWidth: 375, alignSelf: 'center', width: '100%' }}>
      <InvestmentDayBrokerHandoffCard
        availability="nordnet"
        phase={handoff.phase}
        fundName={listing.fundName}
        isin={listing.isin}
        plannedAmountLabel={ready.plannedAmountLabel}
        onOpen={() => {
          void handoff.open();
        }}
        onOpenAgain={() => {
          void handoff.open();
        }}
        onRetry={() => {
          void handoff.open();
        }}
        onReport={noteLocalAction}
        onChooseBroker={noteLocalAction}
      />
      {localAction > 0 ? (
        <AppText variant="meta" color="positive" style={{ marginTop: spacing.sm }}>
          {`Local action received (${localAction}). No server call.`}
        </AppText>
      ) : null}
    </View>
  );
}
