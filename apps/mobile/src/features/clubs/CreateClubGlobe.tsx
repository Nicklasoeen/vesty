import { View } from 'react-native';

import { useTheme } from '@/theme';

export function CreateClubGlobe() {
  const { colors } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 132,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E5EEE7',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: 98,
          height: 98,
          borderRadius: 49,
          borderWidth: 1,
          borderColor: '#52746A',
          backgroundColor: colors.mintSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 42,
            height: 98,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: '#6B9381',
            borderRadius: 49,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: 98,
            height: 42,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#6B9381',
            borderRadius: 49,
          }}
        />
      </View>
    </View>
  );
}
