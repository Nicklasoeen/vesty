import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: boolean;
}

/**
 * Small labeled field for auth and future forms. Not a form library.
 */
export function TextField({ label, error = false, editable = true, ...inputProps }: TextFieldProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View>
      <AppText variant="meta" color="secondary">
        {label}
      </AppText>
      <TextInput
        {...inputProps}
        editable={editable}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          typography.body,
          {
            marginTop: spacing.xs,
            borderRadius: radius.md,
            borderColor: error ? colors.negative : colors.border,
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            minHeight: 44,
            opacity: editable ? 1 : 0.5,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
});
