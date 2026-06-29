/*
# Profile cover photo + message delivery tracking

Adds cover_url to profiles for social profile banners.
Adds delivered_at to pen_pal_messages for delivery receipts.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url text;

ALTER TABLE public.pen_pal_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

COMMENT ON COLUMN public.profiles.cover_url IS 'Cover banner image URL for social profile page';
COMMENT ON COLUMN public.pen_pal_messages.delivered_at IS 'When message was delivered to receiver';
