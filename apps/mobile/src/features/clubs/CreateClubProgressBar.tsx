import { View } from 'react-native';

import { useTheme } from '@/theme';

import { createClubStepIndex, type CreateClubStep } from './createClubWizard';

export function CreateClubProgressBar({ step }: { step: CreateClubStep }) {
  const { colors } = useTheme();
  const current = createClubStepIndex(step);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: 5 }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: index <= current ? colors.accent : colors.border,
          }}
        />
      ))}
    </View>
  );
}
