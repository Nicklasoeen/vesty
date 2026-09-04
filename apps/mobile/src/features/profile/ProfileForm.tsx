import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuth } from '@/features/auth/useAuth';
import { useOptionalClubs } from '@/features/clubs/ClubsProvider';
import { initialsFromIdentity } from '@/features/clubs/initials';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, TextField } from '@/ui';

import * as profileApi from './api';
import { DISPLAY_NAME_MAX_LENGTH, normalizeDisplayName, validateDisplayName } from './displayName';
import { pickProcessedAvatar } from './pickAvatar';
import { useProfile } from './ProfileProvider';

interface ProfileFormProps {
  mode: 'onboarding' | 'edit';
  onCompleted: () => void;
}

export function ProfileForm({ mode, onCompleted }: ProfileFormProps) {
  const { spacing } = useTheme();
  const { user } = useAuth();
  const { profile, avatarSource, refresh } = useProfile();
  const clubs = useOptionalClubs();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const previewSource = localPhotoUri
    ? { uri: localPhotoUri }
    : removeRequested
      ? undefined
      : avatarSource;
  const previewInitials = initialsFromIdentity(name, user?.email ?? null);
  const hasExistingPhoto = Boolean(profile?.avatarPath) && !removeRequested;
  const showRemove = Boolean(localPhotoUri) || hasExistingPhoto;
  const normalizedName = normalizeDisplayName(name);
  const nameChanged = normalizedName !== (profile?.displayName ?? '');
  const photoChanged = Boolean(localPhotoUri) || (removeRequested && Boolean(profile?.avatarPath));
  const isDirty = nameChanged || photoChanged;
  const saveDisabled = isSubmitting || (mode === 'edit' && !isDirty);
  const actionLabel = mode === 'edit' ? 'Save' : 'Continue';

  const persistAndRefresh = async () => {
    await refresh();
    await clubs?.refresh();
  };

  const onAddPhoto = async () => {
    const picked = await pickProcessedAvatar();
    if (picked.ok) {
      setLocalPhotoUri(picked.uri);
      setRemoveRequested(false);
      setPhotoError(null);
      return;
    }
    if (picked.reason === 'denied') {
      setPhotoError(
        mode === 'edit'
          ? 'Photo access is off. You can save with initials.'
          : 'Photo access is off. You can continue with initials.',
      );
      return;
    }
    if (picked.reason === 'failed') {
      setPhotoError('Unable to use that photo');
    }
  };

  const onSubmit = async () => {
    if (submittingRef.current || isSubmitting) {
      return;
    }

    const nameError = validateDisplayName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    if (mode === 'edit' && !isDirty) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setPhotoError(null);

    let namePersisted = false;

    try {
      if (mode === 'onboarding' || nameChanged) {
        await profileApi.updateOwnDisplayName(name);
        namePersisted = true;
      }

      if (removeRequested && profile?.avatarPath) {
        try {
          await profileApi.removeOwnAvatar();
        } catch {
          setPhotoError(
            namePersisted
              ? 'Unable to remove photo. Your name was saved.'
              : 'Unable to remove photo',
          );
          await persistAndRefresh();
          return;
        }
      } else if (localPhotoUri) {
        try {
          await profileApi.uploadOwnAvatar(localPhotoUri);
        } catch {
          setPhotoError(
            mode === 'edit'
              ? namePersisted
                ? 'Unable to save photo. Your name was saved. Try again to update the photo.'
                : 'Unable to save photo. Try again.'
              : 'Unable to save photo. You can try again, or continue with initials.',
          );
          await persistAndRefresh();
          return;
        }
      }

      await persistAndRefresh();
      onCompleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your profile right now');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <View>
      <AppText variant="title" accessibilityRole="header">
        {mode === 'edit' ? 'Edit profile' : 'Set up your profile'}
      </AppText>

      <View style={{ marginTop: spacing.xl }}>
        <TextField
          label="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          error={Boolean(error)}
          editable={!isSubmitting}
          accessibilityLabel="Your name"
        />
      </View>

      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xl }}>
        Profile photo
      </AppText>
      <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Avatar
          initials={previewInitials}
          imageSource={previewSource}
          size="lg"
          accessibilityLabel="Profile photo preview"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasExistingPhoto || localPhotoUri ? 'Change photo' : 'Add photo'}
          onPress={() => {
            void onAddPhoto();
          }}
          disabled={isSubmitting}
          style={{ marginTop: spacing.md }}
        >
          <AppText variant="bodyStrong" color="accent">
            {hasExistingPhoto || localPhotoUri ? 'Change photo' : 'Add photo'}
          </AppText>
        </Pressable>
        {showRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            onPress={() => {
              setLocalPhotoUri(null);
              setRemoveRequested(true);
              setPhotoError(null);
            }}
            disabled={isSubmitting}
            style={{ marginTop: spacing.sm }}
          >
            <AppText variant="body" color="secondary">
              Remove photo
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      {photoError ? (
        <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
          {photoError}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={isSubmitting ? 'Saving…' : actionLabel}
          variant="primary"
          block
          disabled={saveDisabled}
          busy={isSubmitting}
          onPress={() => {
            void onSubmit();
          }}
          accessibilityLabel={actionLabel}
        />
      </View>
    </View>
  );
}
