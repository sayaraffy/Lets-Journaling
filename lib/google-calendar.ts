import { supabase } from '@/lib/supabase/client';
import type { Activity } from '@/lib/types';

type SyncResult =
  | { synced: true; google_calendar_event_id: string | null }
  | { synced: false; reason: 'google_not_connected' | 'token_refresh_failed' | 'google_api_error'; message?: string }
  | { error: string };

export async function syncActivityToGoogle(
  action: 'create' | 'update' | 'delete',
  activity: Activity,
): Promise<SyncResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { error: 'No session' };

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, activity }),
    });
    if (!res.ok) {
      return { error: `Sync failed (${res.status})` };
    }
    return await res.json() as SyncResult;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function isGoogleConnected(): Promise<boolean> {
  const { data } = await supabase
    .from('google_tokens')
    .select('user_id')
    .maybeSingle();
  return !!data;
}
