import { supabase } from '@/lib/supabase/client';

/**
 * Ensures the signed-in auth user has a matching `profiles` row.
 *
 * No trigger creates profiles today. RLS already allows an authenticated
 * user to insert their own row (`id = auth.uid()`), with `display_name` optional.
 * Identity is taken only from the session — never from a client-supplied user id.
 */
export async function ensureOwnProfile(userId: string): Promise<void> {
  const { data, error: selectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (data) {
    return;
  }

  const { error: insertError } = await supabase.from('profiles').insert({ id: userId });

  if (insertError && insertError.code !== '23505') {
    throw insertError;
  }
}
