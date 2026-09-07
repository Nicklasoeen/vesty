import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Screen, Surface } from '@/ui';

import { GroupModePrototypeFlow } from './GroupModePrototypeFlow';
import {
  GROUP_MODE_GALLERY_SCENARIOS,
  getGroupModeGalleryScenario,
} from './groupModeGalleryFixtures';

/**
 * Development-only gallery. It owns fixture state, imports no data client,
 * and intentionally has no path to the real create-club mutation.
 */
export function GroupModeGalleryScreen() {
  const { colors, spacing } = useTheme();
  const [scenarioId, setScenarioId] = useState(GROUP_MODE_GALLERY_SCENARIOS[0]!.id);
  const [retryCount, setRetryCount] = useState(0);
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

      <GroupModePrototypeFlow
        key={`${scenario.id}-${retryCount}`}
        initialDraft={scenario.draft}
        catalogState={scenario.catalogState}
        submitState={scenario.submitState}
        fundDetailInitiallyOpen={scenario.fundDetailOpen}
        compact={scenario.compact}
        largeText={scenario.largeText}
        onRetryCatalog={() => setRetryCount((count) => count + 1)}
      />
    </Screen>
  );
}
