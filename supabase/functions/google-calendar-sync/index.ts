import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, activity } = body as {
      action: 'create' | 'update' | 'delete';
      activity: {
        id: string;
        title: string;
        description?: string | null;
        location?: string | null;
        start_time: string;
        end_time: string;
        color?: string;
        reminder_minutes?: number | null;
        google_calendar_event_id?: string | null;
      };
    };

    // Fetch the user's Google tokens
    const { data: tokenRow } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, expires_at, scopes')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenRow || !tokenRow.refresh_token) {
      return new Response(JSON.stringify({
        synced: false,
        reason: 'google_not_connected',
        message: 'Google Calendar is not connected. Connect it in Settings to enable sync.',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Refresh the access token if needed
    let accessToken = tokenRow.access_token;
    const expired = !tokenRow.expires_at || new Date(tokenRow.expires_at) <= new Date();
    if (expired) {
      const refreshed = await refreshGoogleToken(tokenRow.refresh_token);
      if (!refreshed.ok) {
        return new Response(JSON.stringify({
          synced: false,
          reason: 'token_refresh_failed',
          message: 'Google authorization expired. Please reconnect Google in Settings.',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const tokens = await refreshed.json();
      accessToken = tokens.access_token;
      await supabase.from('google_tokens').update({
        access_token: tokens.access_token,
        expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      }).eq('user_id', user.id);
    }

    const calendarId = 'primary';
    const eventPayload = {
      summary: activity.title,
      description: activity.description ?? '',
      location: activity.location ?? '',
      start: { dateTime: activity.start_time, timeZone: 'UTC' },
      end: { dateTime: activity.end_time, timeZone: 'UTC' },
      reminders: activity.reminder_minutes
        ? { useDefault: false, overrides: [{ method: 'popup', minutes: activity.reminder_minutes }] }
        : { useDefault: true },
    };

    let googleEventId: string | null = activity.google_calendar_event_id ?? null;

    if (action === 'create') {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({
          synced: false, reason: 'google_api_error', message: err,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const created = await res.json();
      googleEventId = created.id;
    } else if (action === 'update' && googleEventId) {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${googleEventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({
          synced: false, reason: 'google_api_error', message: err,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else if (action === 'delete' && googleEventId) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${googleEventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      googleEventId = null;
    }

    return new Response(JSON.stringify({ synced: true, google_calendar_event_id: googleEventId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Internal error',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function refreshGoogleToken(refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), { status: 500 });
  }
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
}
