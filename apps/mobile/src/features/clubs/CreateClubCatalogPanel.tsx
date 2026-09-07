import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button, Surface } from '@/ui';

import { presentCreateClubCatalogPanel } from './presentCreateClub';
import type { CatalogLoadState } from './singleFundCatalog';

interface CreateClubCatalogPanelProps {
  state: CatalogLoadState;
  message?: string | null;
  onRetry?: () => void;
}

export function CreateClubCatalogPanel({ state, message, onRetry }: CreateClubCatalogPanelProps) {
  const { colors, spacing } = useTheme();

  if (state === 'ready' && !message) {
    return null;
  }

  if (state === 'loading' || state === 'idle') {
    const loading = presentCreateClubCatalogPanel(state);
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading funds" color={colors.accent} />
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {loading.title}
        </AppText>
      </View>
    );
  }

  const copy = presentCreateClubCatalogPanel(state === 'ready' ? 'unavailable' : state);
  return (
    <Surface bordered style={{ padding: spacing.md, marginBottom: spacing.md }}>
      <AppText variant="bodyStrong">{copy.title}</AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {message ?? copy.body}
      </AppText>
      {state === 'error' && onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </Surface>
  );
}
