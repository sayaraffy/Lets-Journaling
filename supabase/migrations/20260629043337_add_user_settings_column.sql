/*
# User Settings Persistence

Adds a `settings` JSONB column to profiles for persisting user preferences
(language, notification toggles) so they survive across sessions and devices.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.settings IS
  'User preferences: { language: "en"|"id", notifications: { activity, journal, water, pomodoro, streak, penpal, quiet_hours } }';
