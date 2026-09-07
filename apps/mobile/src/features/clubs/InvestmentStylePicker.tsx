import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AllocationBar, AppText, SelectableOptionCard } from '@/ui';

import {
  packageExposureSlices,
  type CuratedInvestmentPackage,
  type CuratedPackageId,
} from './curatedInvestmentPackages';
import { presentCreateClubInvestmentOption } from './presentCreateClub';

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
  const { spacing } = useTheme();
  const [holdingsOpenId, setHoldingsOpenId] = useState<CuratedPackageId | null>(null);

  return (
    <View>
      {packages.map((item, index) => {
        const selected = item.id === selectedId;
        const presented = presentCreateClubInvestmentOption(item, selected);
        const holdingsOpen = selected && holdingsOpenId === item.id;

        return (
          <View key={item.id} style={{ marginTop: index === 0 ? 0 : spacing.md }}>
            <SelectableOptionCard
              title={presented.title}
              description={selected ? null : presented.description}
              caption={selected ? null : presented.position}
              selected={selected}
              disabled={disabled}
              accessibilityLabel={`${presented.title}. ${presented.position}. ${presented.description}`}
              onPress={() => onSelect(item.id)}
            >
              {selected ? (
                <View>
                  {presented.exposureLines.map((line) => (
                    <AppText key={line} variant="supporting" style={{ marginTop: 2 }}>
                      {line}
                    </AppText>
                  ))}
                  <View style={{ marginTop: spacing.sm }}>
                    <AllocationBar allocations={packageExposureSlices(item)} showLegend={false} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={holdingsOpen ? 'Hide investments' : 'See investments'}
                    onPress={() => {
                      setHoldingsOpenId(holdingsOpen ? null : item.id);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      marginTop: spacing.sm,
                      alignSelf: 'flex-start',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <AppText variant="meta" color="accent">
                      {holdingsOpen ? 'Hide investments' : 'See investments'}
                    </AppText>
                  </Pressable>
                  {holdingsOpen
                    ? presented.holdings.map((holding) => (
                        <AppText key={holding.ticker} variant="supporting" style={{ marginTop: 4 }}>
                          {holding.line}
                        </AppText>
                      ))
                    : null}
                </View>
              ) : (
                <AppText variant="supporting">{presented.allocationPreview}</AppText>
              )}
            </SelectableOptionCard>
          </View>
        );
      })}
    </View>
  );
}
