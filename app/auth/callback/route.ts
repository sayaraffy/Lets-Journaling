import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/today';
  const googleCalendar = requestUrl.searchParams.get('google_calendar') === '1';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session && googleCalendar) {
      const providerRefresh = (data.session.provider_refresh_token ?? data.session.refresh_token) as string;
      const providerAccess = (data.session.provider_token ?? data.session.access_token) as string;
      const expiresAt = data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : new Date(Date.now() + 3600 * 1000).toISOString();
      if (providerRefresh) {
        await supabase.from('google_tokens').upsert({
          user_id: data.user.id,
          access_token: providerAccess,
          refresh_token: providerRefresh,
          expires_at: expiresAt,
          scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar'],
        }, { onConflict: 'user_id' });
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
