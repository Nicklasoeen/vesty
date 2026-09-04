import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button, TextField } from '@/ui';
import { useAuth } from './useAuth';

type AuthMode = 'sign-in' | 'sign-up';

function looksLikeEmail(value: string): boolean {
  return value.includes('@') && value.includes('.');
}

/**
 * Email + password form with sign-in and create-account modes.
 */
export function AuthForm() {
  const { spacing } = useTheme();
  const { signIn, signUp, isSubmitting } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setPendingConfirmation(false);
  };

  const onSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !looksLikeEmail(trimmedEmail)) {
      setError('Enter a valid email');
      return;
    }

    if (!password) {
      setError('Enter a password');
      return;
    }

    setError(null);

    const result = mode === 'sign-in' ? await signIn(trimmedEmail, password) : await signUp(trimmedEmail, password);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if ('needsEmailConfirmation' in result && result.needsEmailConfirmation) {
      setPendingConfirmation(true);
    }
  };

  if (pendingConfirmation) {
    return (
      <View>
        <AppText variant="sectionTitle">Check your email</AppText>
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          Check your email to confirm your account.
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          onPress={() => switchMode('sign-in')}
          style={{ marginTop: spacing.lg }}
        >
          <AppText variant="bodyStrong" color="accent">
            Back to sign in
          </AppText>
        </Pressable>
      </View>
    );
  }

  const submitLabel = isSubmitting ? (mode === 'sign-in' ? 'Signing in…' : 'Creating account…') : mode === 'sign-in' ? 'Sign in' : 'Create account';

  return (
    <View>
      <AppText variant="title" accessibilityRole="header">
        {mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </AppText>

      <View style={{ marginTop: spacing.xl }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          editable={!isSubmitting}
          accessibilityLabel="Email"
        />
      </View>

      <View style={{ marginTop: spacing.md }}>
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'password'}
          textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
          secureTextEntry
          editable={!isSubmitting}
          accessibilityLabel="Password"
          returnKeyType="go"
          onSubmitEditing={() => {
            void onSubmit();
          }}
        />
      </View>

      {error ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={submitLabel}
          variant="primary"
          block
          disabled={isSubmitting}
          busy={isSubmitting}
          onPress={() => {
            void onSubmit();
          }}
          accessibilityLabel={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          accessibilityHint={isSubmitting ? 'Please wait' : undefined}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mode === 'sign-in' ? 'Create account' : 'Sign in'}
        accessibilityHint={mode === 'sign-in' ? 'Switch to create account' : 'Switch to sign in'}
        disabled={isSubmitting}
        onPress={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        style={{ marginTop: spacing.lg, opacity: isSubmitting ? 0.5 : 1 }}
      >
        <AppText variant="body" color="accent">
          {mode === 'sign-in' ? 'Create account' : 'Sign in'}
        </AppText>
      </Pressable>
    </View>
  );
}
