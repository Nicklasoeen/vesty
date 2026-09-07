import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateClubJourney } from '@/features/clubs/CreateClubJourney';
import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import {
  GROUP_MODE_GALLERY_SCENARIOS,
  galleryFixtureSendsServerCall,
  getGroupModeGalleryScenario,
} from './groupModeGalleryFixtures';

function galleryScenarioId(value: string | undefined): string | null {
  if (!value || !GROUP_MODE_GALLERY_SCENARIOS.some((item) => item.id === value)) {
    return null;
  }
  return value;
}

/**
 * Development-only gallery. It owns fixture state, imports no data client,
 * and intentionally has no path to the real create-club mutation.
 */
export function GroupModeGalleryScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scenario?: string; chrome?: string }>();
  const hideChrome = params.chrome === '0';
  const requestedScenarioId = galleryScenarioId(
    typeof params.scenario === 'string' ? params.scenario : undefined,
  );
  const [scenarioId, setScenarioId] = useState(
    requestedScenarioId ?? GROUP_MODE_GALLERY_SCENARIOS[0]!.id,
  );
  const [retryCount, setRetryCount] = useState(0);
  const [draft, setDraft] = useState(() => getGroupModeGalleryScenario(scenarioId).draft);
  const [appliedQueryScenario, setAppliedQueryScenario] = useState(requestedScenarioId);

  if (requestedScenarioId && requestedScenarioId !== appliedQueryScenario) {
    setAppliedQueryScenario(requestedScenarioId);
    setScenarioId(requestedScenarioId);
    setDraft(getGroupModeGalleryScenario(requestedScenarioId).draft);
    setRetryCount(0);
  }

  const scenario = getGroupModeGalleryScenario(scenarioId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: hideChrome ? 0 : insets.top }}>
      {hideChrome ? null : (
      <View
        style={{
          paddingHorizontal: scenario.compact ? spacing.sm : spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <AppText variant="label">Development state gallery</AppText>
        <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
          Uses local fixtures only. No catalog, club, auth mutation, or submit request is sent.
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.sm }}
        >
          {GROUP_MODE_GALLERY_SCENARIOS.map((item) => {
            const active = item.id === scenario.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setScenarioId(item.id);
                  setDraft(item.draft);
                  setRetryCount(0);
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
        {retryCount > 0 ? (
          <AppText variant="meta" color="positive">
            {`Retry callback received locally (${retryCount}).`}
          </AppText>
        ) : null}
      </View>
      )}

      <View style={{ flex: 1, minHeight: scenario.compact ? 812 : undefined }}>
        <CreateClubJourney
          key={`${scenario.id}-${retryCount}`}
          draft={draft}
          onDraftChange={setDraft}
          products={scenario.products}
          catalogState={scenario.catalogState}
          catalogMessage={scenario.catalogMessage}
          onRetryCatalog={() => setRetryCount((count) => count + 1)}
          submitState={scenario.submitState}
          submitMessage={scenario.submitMessage}
          onSubmit={() => {
            if (galleryFixtureSendsServerCall(scenario)) {
              throw new Error('Gallery must not send a server call');
            }
          }}
          onGoToClubs={() => undefined}
          onStartNewSetup={() => undefined}
          onSaveAndLeave={() => undefined}
          onDiscardSetup={() => undefined}
          leaveSheetOpen={scenario.leaveSheetOpen}
          fundDetailOpen={scenario.fundDetailOpen}
          compact={scenario.compact}
          largeText={scenario.largeText}
          onLeave={() => undefined}
          phase={scenario.phase}
          introVisible={scenario.introVisible}
          introDismissed={scenario.introDismissed}
          onStartClub={() => undefined}
          onReturnToIntro={() => undefined}
          success={scenario.success}
          onInviteMembers={() => {
            if (galleryFixtureSendsServerCall(scenario)) {
              throw new Error('Gallery must not send a server call');
            }
          }}
          onGoToClub={() => undefined}
          reduceMotion={scenario.reduceMotion}
          playCelebration={scenario.playCelebration}
          embedded
        />
      </View>
    </View>
  );
}
