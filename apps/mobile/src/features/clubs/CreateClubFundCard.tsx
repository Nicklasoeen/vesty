import { Linking, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import { CreateClubGlobe } from './CreateClubGlobe';
import { presentSingleFundCard, presentSingleFundDetails } from './presentSingleFund';
import { isAllowedSingleFundSourceUrl } from './singleFundSourceUrl';
import type { SingleFundProduct } from './singleFundCatalog';

interface CreateClubFundCardProps {
  product: SingleFundProduct;
  selected: boolean;
  detailOpen: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggleDetails: () => void;
}

export function CreateClubFundCard({
  product,
  selected,
  detailOpen,
  disabled = false,
  onSelect,
  onToggleDetails,
}: CreateClubFundCardProps) {
  const { colors, radius, spacing } = useTheme();
  const card = presentSingleFundCard(product, selected);
  const details = presentSingleFundDetails(product);

  return (
    <View
      style={{
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <CreateClubGlobe />
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={card.title}
        disabled={disabled}
        onPress={onSelect}
        style={{ padding: spacing.lg }}
      >
        <AppText variant="eyebrow">{product.kind === 'fund' ? 'Fund' : product.kind}</AppText>
        <AppText variant="title" style={{ marginTop: spacing.sm }}>
          {card.title}
        </AppText>
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {card.description}
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View>
            <AppText variant="statLabel">Risk</AppText>
            <AppText variant="bodyStrong">{details.risk.replace('Risk ', '')}</AppText>
          </View>
          <View>
            <AppText variant="statLabel">Horizon</AppText>
            <AppText variant="bodyStrong">{details.horizon}</AppText>
          </View>
        </View>
        <View style={{ marginTop: spacing.md, gap: 4 }}>
          {card.facts
            .filter((fact) => !fact.startsWith('Risk') && fact !== details.horizon)
            .map((fact) => (
              <AppText key={fact} variant="supporting">
                {fact}
              </AppText>
            ))}
        </View>
      </Pressable>
      {selected ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailOpen ? 'Hide fund details' : 'View fund details'}
            onPress={onToggleDetails}
          >
            <AppText variant="bodyStrong" color="accent">
              {detailOpen ? 'Hide fund details' : 'View fund details'}
            </AppText>
          </Pressable>
          {detailOpen ? (
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
              <AppText variant="bodyStrong">
                {details.legalName}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                {`ISIN ${details.isin}`}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                {`Manager ${details.managerName}`}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                {details.risk}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                {details.horizon}
              </AppText>
              {details.brokers ? (
                <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                  {details.brokers}
                </AppText>
              ) : null}
              {details.costs.map((cost) => (
                <View key={cost.broker} style={{ marginTop: spacing.sm }}>
                  <AppText variant="bodyStrong">{cost.label}</AppText>
                  <AppText variant="supporting">{cost.source}</AppText>
                  {cost.minimumNote ? <AppText variant="supporting">{cost.minimumNote}</AppText> : null}
                </View>
              ))}
              {details.links.map((link) => (
                <Pressable
                  key={link.url}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={() => {
                    if (!isAllowedSingleFundSourceUrl(link.url)) {
                      return;
                    }
                    void Linking.openURL(link.url);
                  }}
                  style={{ marginTop: spacing.sm }}
                >
                  <AppText variant="bodyStrong" color="accent">
                    {link.label}
                  </AppText>
                </Pressable>
              ))}
              {details.notes.map((note) => (
                <AppText key={note} variant="supporting" style={{ marginTop: spacing.xs }}>
                  {note}
                </AppText>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
