import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { CreateClubJourney } from '@/features/clubs/CreateClubJourney';
import { useTheme } from '@/theme';
import { AppText, Screen, Surface } from '@/ui';

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
  const params = useLocalSearchParams<{ scenario?: string }>();
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
    <Screen
      contentContainerStyle={{
        paddingHorizontal: scenario.compact ? spacing.sm : spacing.lg,
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
        <AppText variant="label">Development state gallery</AppText>
        <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
          Uses local fixtures only. No catalog, club, auth mutation, or submit request is sent.
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.md }}
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
          <AppText variant="meta" color="positive" style={{ marginTop: spacing.sm }}>
            {`Retry callback received locally (${retryCount}).`}
          </AppText>
        ) : null}
      </Surface>

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
        fundDetailOpen={scenario.fundDetailOpen}
        compact={scenario.compact}
        largeText={scenario.largeText}
        onLeave={() => undefined}
      />
    </Screen>
  );
}
