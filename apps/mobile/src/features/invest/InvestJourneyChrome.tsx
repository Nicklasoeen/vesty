import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CreateClubFooterNote,
  CreateClubPrimaryBar,
  CreateClubStickyFooter,
} from '@/features/clubs/CreateClubPrimaryBar';
import { useTheme } from '@/theme';
import { AppText, VestyWordmark } from '@/ui';

import type { MonthlySavingDetailRow } from './presentMonthlySavingSetup';
import type { InvestJourneyProgress } from './presentInvestJourney';

export function InvestJourneyHeader({
  progress,
  onBack,
  inverted = false,
  embedded = false,
}: {
  progress: InvestJourneyProgress;
  onBack?: (() => void) | null;
  inverted?: boolean;
  embedded?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const ink = inverted ? colors.accentDeep : colors.textPrimary;

  return (
    <View style={{ paddingTop: embedded ? 0 : insets.top + spacing.sm }}>
      <View
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Feather name="chevron-left" size={26} color={ink} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <VestyWordmark color={ink} height={22} />
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {progress.finished ? (
            <AppText variant="supporting">✓</AppText>
          ) : progress.hidden ? null : (
            <AppText variant="supporting">{`${progress.current} / ${progress.total}`}</AppText>
          )}
        </View>
      </View>
      {progress.hidden ? null : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', gap: 5, marginTop: spacing.md }}
        >
          {Array.from({ length: progress.total }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: index < progress.current ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function InvestJourneyTitle({
  eyebrow,
  titleLead,
  titleEmphasis,
  body,
  inverted = false,
}: {
  eyebrow: string;
  titleLead: string;
  titleEmphasis: string;
  body?: string | null;
  inverted?: boolean;
}) {
  const { colors, spacing } = useTheme();
  const titleColor = inverted ? colors.accentDeep : undefined;
  const bodyColor = inverted ? colors.accentDeep : undefined;

  return (
    <View>
      <AppText variant="eyebrow" style={inverted ? { color: colors.accentDeep } : undefined}>
        {eyebrow}
      </AppText>
      <AppText
        variant="display"
        accessibilityRole="header"
        style={{ marginTop: spacing.xl, color: titleColor }}
      >
        {titleEmphasis ? `${titleLead}\n${titleEmphasis}` : titleLead}
      </AppText>
      {body ? (
        <AppText
          variant="body"
          color={inverted ? undefined : 'secondary'}
          style={{ marginTop: spacing.md, color: bodyColor }}
        >
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

export function InvestDetailRows({ rows }: { rows: readonly MonthlySavingDetailRow[] }) {
  const { colors, spacing } = useTheme();
  if (rows.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: spacing.xl }}>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={{
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="supporting">{row.label}</AppText>
          {row.previousValue ? (
            <AppText
              variant="meta"
              color="secondary"
              style={{ marginTop: spacing.xs, textDecorationLine: 'line-through' }}
            >
              {row.previousValue}
            </AppText>
          ) : null}
          <AppText variant="title" style={{ marginTop: spacing.xs }}>
            {row.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function InvestStepList({ steps }: { steps: readonly { n: number; text: string }[] }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
      {steps.map((step) => (
        <View key={step.n} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceSecondary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="meta">{String(step.n)}</AppText>
          </View>
          <AppText variant="body" color="secondary" style={{ flex: 1 }}>
            {step.text}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function InvestPrivacyNote({ children }: { children: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceSecondary,
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      <Feather name="lock" size={16} color={colors.textSecondary} accessibilityElementsHidden />
      <AppText variant="supporting" style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

export function InvestAlert({ children }: { children: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        marginTop: spacing.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: radius.md,
      }}
    >
      <AppText variant="body">{children}</AppText>
    </View>
  );
}

export function InvestHeroCard({
  eyebrow,
  value,
  supporting,
}: {
  eyebrow: string;
  value: string;
  supporting?: string | null;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        marginTop: spacing.xl,
        padding: spacing.lg,
        borderRadius: radius.xl,
        backgroundColor: colors.mintSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText variant="eyebrow">{eyebrow}</AppText>
      <AppText variant="display" style={{ marginTop: spacing.md }}>
        {value}
      </AppText>
      {supporting ? (
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          {supporting}
        </AppText>
      ) : null}
    </View>
  );
}

export function InvestAttestationCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{
        marginTop: spacing.xl,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        minHeight: 44,
      }}
    >
      <Feather
        name={checked ? 'check-square' : 'square'}
        size={22}
        color={checked ? colors.accent : colors.textSecondary}
      />
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function InvestPrimaryBar({
  label,
  onPress,
  enabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  enabled: boolean;
  busy?: boolean;
}) {
  return (
    <CreateClubPrimaryBar
      label={label}
      onPress={onPress}
      enabled={enabled}
      busy={busy}
    />
  );
}

export function InvestStickyFooter({
  children,
  note,
}: {
  children: ReactNode;
  note?: string | null;
}) {
  return (
    <CreateClubStickyFooter>
      {children}
      {note ? <CreateClubFooterNote>{note}</CreateClubFooterNote> : null}
    </CreateClubStickyFooter>
  );
}
