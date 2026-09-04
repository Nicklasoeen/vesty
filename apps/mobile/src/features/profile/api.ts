import { supabase } from '@/lib/supabase/client';

import { AVATARS_BUCKET, AVATAR_SIGNED_URL_SECONDS, ownAvatarPath } from './avatarPath';
import { parsePreferredBroker, type PreferredBroker } from './brokers';
import { isDisplayNameComplete, normalizeDisplayName, validateDisplayName } from './displayName';
import type { CurrentProfile } from './types';

interface ProfileIdentityRow {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
}

async function readOwnPreferredBroker(): Promise<PreferredBroker | null> {
  const result = await supabase.rpc('get_own_preferred_broker');
  if (result.error) {
    throw result.error;
  }
  return parsePreferredBroker(result.data);
}

function mapRow(row: ProfileIdentityRow, preferredBroker: PreferredBroker | null): CurrentProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    preferredBroker,
  };
}

async function mapOwnRow(row: ProfileIdentityRow): Promise<CurrentProfile> {
  return mapRow(row, await readOwnPreferredBroker());
}

export async function fetchOwnProfile(userId: string): Promise<CurrentProfile | null> {
  const result = await supabase
    .from('profiles')
    .select('id, display_name, avatar_path')
    .eq('id', userId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapOwnRow(result.data) : null;
}

export async function updateOwnDisplayName(displayName: string): Promise<CurrentProfile> {
  const name = normalizeDisplayName(displayName);
  const invalid = validateDisplayName(name);
  if (invalid) {
    throw new Error(invalid);
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw userError ?? new Error('Sign in to continue');
  }

  const result = await supabase
    .from('profiles')
    .update({ display_name: name })
    .eq('id', userResult.user.id)
    .select('id, display_name, avatar_path')
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error('Unable to save your name right now');
  }

  return mapOwnRow(result.data);
}

export async function updateOwnPreferredBroker(next: PreferredBroker | null): Promise<PreferredBroker | null> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw userError ?? new Error('Sign in to continue');
  }

  const result = await supabase
    .from('profiles')
    .update({ preferred_broker: next })
    .eq('id', userResult.user.id);

  if (result.error) {
    throw result.error;
  }

  return next;
}

export async function signAvatarUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const signed = new Map<string, string>();
  if (unique.length === 0) {
    return signed;
  }

  const result = await supabase.storage.from(AVATARS_BUCKET).createSignedUrls(unique, AVATAR_SIGNED_URL_SECONDS);
  if (result.error) {
    console.warn('[profile] sign avatar urls', result.error.message);
    return signed;
  }

  for (const item of result.data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      signed.set(item.path, item.signedUrl);
    }
  }

  return signed;
}

async function uploadAvatarBytes(userId: string, uri: string): Promise<string> {
  const path = ownAvatarPath(userId);
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected photo');
  }
  const bytes = await response.arrayBuffer();
  const result = await supabase.storage.from(AVATARS_BUCKET).upload(path, bytes, {
    upsert: true,
    contentType: 'image/jpeg',
  });

  if (result.error) {
    throw result.error;
  }

  return path;
}

export async function uploadOwnAvatar(localUri: string): Promise<string> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw userError ?? new Error('Sign in to continue');
  }

  const path = await uploadAvatarBytes(userResult.user.id, localUri);

  const result = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', userResult.user.id)
    .select('id, display_name, avatar_path')
    .single();

  if (result.error) {
    throw result.error;
  }

  return path;
}

export async function removeOwnAvatar(): Promise<void> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw userError ?? new Error('Sign in to continue');
  }

  const path = ownAvatarPath(userResult.user.id);

  const profileResult = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', userResult.user.id);

  if (profileResult.error) {
    throw profileResult.error;
  }

  const storageResult = await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  if (storageResult.error) {
    console.warn('[profile] avatar object already missing');
  }
}

export function profileIsOnboarded(profile: CurrentProfile | null): boolean {
  return isDisplayNameComplete(profile?.displayName);
}
