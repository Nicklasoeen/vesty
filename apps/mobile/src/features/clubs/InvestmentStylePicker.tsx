import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AllocationBar, AppText } from '@/ui';

import {
  compactAllocationPreview,
  packageExposureSlices,
  packageHoldingLines,
  type CuratedInvestmentPackage,
  type CuratedPackageId,
} from './curatedInvestmentPackages';

interface InvestmentStylePickerProps {
  packages: readonly CuratedInvestmentPackage[];
  selectedId: CuratedPackageId | null;
  onSelect: (id: CuratedPackageId) => void;
  disabled?: boolean;
}

export function InvestmentStylePicker({
  packages,
  selectedId,
  onSelect,
  disabled = false,
}: InvestmentStylePickerProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View>
      {packages.map((item, index) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${item.displayName}. ${item.relativePosition}. ${item.shortDescription}`}
            disabled={disabled}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => ({
              marginTop: index === 0 ? 0 : spacing.md,
              padding: spacing.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
              backgroundColor: selected ? colors.accentMuted : colors.surface,
              opacity: pressed && !disabled ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <AppText variant="bodyStrong" color={selected ? 'primary' : 'primary'} style={{ flex: 1, paddingRight: spacing.sm }}>
                {item.displayName}
              </AppText>
              <AppText variant="meta" color="secondary">
                {item.relativePosition}
              </AppText>
            </View>
            <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
              {item.shortDescription}
            </AppText>
            <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
              {compactAllocationPreview(item)}
            </AppText>
            {selected ? (
              <View style={{ marginTop: spacing.lg }}>
                <AppText variant="sectionTitle">How the money is spread</AppText>
                <View style={{ marginTop: spacing.md }}>
                  <AllocationBar allocations={packageExposureSlices(item)} />
                </View>
                <AppText variant="sectionTitle" style={{ marginTop: spacing.xl }}>
                  What you invest in
                </AppText>
                <View style={{ marginTop: spacing.md }}>
                  {packageHoldingLines(item).map((holding) => (
                    <View key={holding.id} style={{ marginBottom: spacing.sm }}>
                      <AppText variant="body">{holding.name}</AppText>
                      <AppText variant="meta" color="secondary">
                        {holding.ticker}
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
