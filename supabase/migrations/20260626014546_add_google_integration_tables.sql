/*
# Google Workspace Integration — Token Storage

## Overview
Adds tables to store Google OAuth tokens and track Google Calendar sync state,
enabling bidirectional Calendar synchronization when the user connects Google Workspace.

## New Tables

1. **google_tokens** — stores the user's Google OAuth refresh/access tokens and scopes.
   One row per user. Used by edge functions to call Google APIs on the user's behalf.
2. **google_sync_state** — tracks the last sync timestamp and sync token per calendar,
   enabling incremental bidirectional sync without re-fetching everything.

## Security
- RLS enabled on both tables.
- `google_tokens` is strictly owner-only (SELECT/INSERT/UPDATE/DELETE scoped to auth.uid()).
  Tokens must never be readable by anyone except the owner; even admins cannot read them.
- `google_sync_state` is owner-only.
- `user_id` defaults to `auth.uid()`.

## Important Notes
1. Access tokens are short-lived (~1h); refresh tokens are long-lived. Edge functions
   use the refresh token to obtain fresh access tokens before each Google API call.
2. The `scopes` array records which Google APIs the user authorized (Calendar, Drive, Docs).
3. No actual Google credentials are stored in this migration — only the schema.
*/

CREATE TABLE IF NOT EXISTS google_tokens (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_google_tokens" ON google_tokens;
CREATE POLICY "select_own_google_tokens" ON google_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_google_tokens" ON google_tokens;
CREATE POLICY "insert_own_google_tokens" ON google_tokens FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_google_tokens" ON google_tokens;
CREATE POLICY "update_own_google_tokens" ON google_tokens FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_google_tokens" ON google_tokens;
CREATE POLICY "delete_own_google_tokens" ON google_tokens FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS google_sync_state (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL DEFAULT 'primary',
  last_sync_at timestamptz NOT NULL DEFAULT now(),
  next_sync_token text,
  PRIMARY KEY (user_id, calendar_id)
);

ALTER TABLE google_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sync_state" ON google_sync_state;
CREATE POLICY "select_own_sync_state" ON google_sync_state FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sync_state" ON google_sync_state;
CREATE POLICY "insert_own_sync_state" ON google_sync_state FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sync_state" ON google_sync_state;
CREATE POLICY "update_own_sync_state" ON google_sync_state FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sync_state" ON google_sync_state;
CREATE POLICY "delete_own_sync_state" ON google_sync_state FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_google_tokens_updated_at ON google_tokens;
CREATE TRIGGER trg_google_tokens_updated_at BEFORE UPDATE ON google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();