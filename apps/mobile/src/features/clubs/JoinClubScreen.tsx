import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AppText, Button, Screen, TextField } from '@/ui';
import { getClubContributionPolicy, getMyContributionCommitment } from './api';
import { normalizeInviteTokenInput } from './inviteToken';
import { needsFlexibleContributionSetup } from './presentContribution';
import { attachClub, joinClub, useClubs } from './useClubs';

export function JoinClubScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const initialCode = useMemo(() => {
    const value = params.code;
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }
    return value ?? '';
  }, [params.code]);
  const { refresh, selectClub } = useClubs();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const joinedClubIdRef = useRef<string | null>(null);

  const normalized = normalizeInviteTokenInput(code);
  const canSubmit = normalized.length === 24 && !isSubmitting;

  const goBack = () => {
    if (isSubmitting) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  const onJoin = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!joinedClubIdRef.current) {
        const joined = await joinClub(normalized);
        joinedClubIdRef.current = joined.clubId;
      }
      const joinedClubId = joinedClubIdRef.current;
      await attachClub(refresh, selectClub, joinedClubId);
      const [policy, commitment] = await Promise.all([
        getClubContributionPolicy(joinedClubId),
        getMyContributionCommitment(joinedClubId),
      ]);
      if (needsFlexibleContributionSetup(policy, commitment)) {
        router.replace({
          pathname: '/clubs/contribution-setup',
          params: { clubId: joinedClubId },
        });
        return;
      }
      router.replace('/club');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invite is invalid or expired');
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            hitSlop={10}
            style={({ pressed }) => ({ marginTop: spacing.md, opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start' })}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="title" accessibilityRole="header">
              Join club
            </AppText>
            <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
              Enter the invite code you were given.
            </AppText>

            <View style={{ marginTop: spacing.lg }}>
              <TextField
                label="Invite code"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                editable={!isSubmitting}
                error={Boolean(error)}
                accessibilityLabel="Invite code"
                returnKeyType="go"
                onSubmitEditing={() => {
                  void onJoin();
                }}
              />
            </View>

            {error ? (
              <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
                {error}
              </AppText>
            ) : null}

            <View style={{ marginTop: spacing.xl }}>
              <Button
                label={isSubmitting ? 'Joining…' : 'Join club'}
                variant="primary"
                block
                disabled={!canSubmit}
                busy={isSubmitting}
                onPress={() => {
                  void onJoin();
                }}
              />
            </View>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}
