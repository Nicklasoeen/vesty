import { Pressable, View } from 'react-native';

import type { ClubContributionPolicy } from '@/features/clubs/contributionPolicy';
import { useTheme } from '@/theme';
import { AppText, Button, IconButton, TextField } from '@/ui';

import {
  canContinueContributionProposalDraft,
  contributionProposalActionDescription,
  contributionProposalActionLabel,
  equalToFlexibleTransitionCopy,
  type ContributionProposalAction,
  type ContributionProposalDraft,
} from './createContributionProposal';
import { presentContributionCreateOptions } from './presentContributionProposal';

interface CreateContributionProposalFormProps {
  policy: ClubContributionPolicy;
  draft: ContributionProposalDraft;
  error: string | null;
  onChange: (draft: ContributionProposalDraft) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function CreateContributionProposalForm({
  policy,
  draft,
  error,
  onChange,
  onBack,
  onContinue,
}: CreateContributionProposalFormProps) {
  const { colors, spacing } = useTheme();
  const options = presentContributionCreateOptions({
    currentMode: policy.mode,
    currentEqualAmountMinor: policy.equalAmountMinor,
  });
  const canContinue = canContinueContributionProposalDraft({
    currentMode: policy.mode,
    currentEqualAmountMinor: policy.equalAmountMinor,
    action: draft.action,
    amountInput: draft.amountInput,
  });
  const showAmount =
    draft.action === 'change_amount' || draft.action === 'switch_to_equal';

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={onBack} />
        <AppText variant="label" style={{ marginLeft: spacing.sm }}>
          Contribution
        </AppText>
      </View>

      <AppText variant="title" accessibilityRole="header">
        Propose a change
      </AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
        Current
      </AppText>
      <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
        {options.currentStyle}
      </AppText>
      <AppText variant="supporting" style={{ marginTop: 2 }}>
        {options.currentDetail}
      </AppText>

      <View style={{ marginTop: spacing.xl }}>
        {options.actions.map((action: ContributionProposalAction) => {
          const selected = draft.action === action;
          return (
            <Pressable
              key={action}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={contributionProposalActionLabel(action)}
              onPress={() => onChange({ ...draft, action })}
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <AppText variant="bodyStrong" color={selected ? 'primary' : 'secondary'}>
                {contributionProposalActionLabel(action)}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: 4 }}>
                {contributionProposalActionDescription(action)}
              </AppText>
              {action === 'switch_to_flexible' && selected ? (
                <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
                  {equalToFlexibleTransitionCopy()}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {showAmount ? (
        <View style={{ marginTop: spacing.lg }}>
          <TextField
            label={draft.action === 'change_amount' ? 'New amount' : 'Shared amount'}
            value={draft.amountInput}
            onChangeText={(amountInput) => onChange({ ...draft, amountInput })}
            keyboardType="number-pad"
            inputMode="numeric"
            autoCorrect={false}
            error={Boolean(error)}
            accessibilityLabel="Amount in kroner"
          />
          <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
            kroner per Investment Day
          </AppText>
        </View>
      ) : null}

      {error ? (
        <AppText variant="supporting" color="negative" style={{ marginTop: spacing.md }}>
          {error}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label="Continue"
          variant="primary"
          block
          disabled={!canContinue}
          onPress={onContinue}
        />
      </View>
    </View>
  );
}
