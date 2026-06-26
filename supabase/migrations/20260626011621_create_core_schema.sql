/*
# Let's Journaling — Core Database Schema

## Overview
Creates the foundational schema for the Let's Journaling platform: a privacy-focused
journaling application with daily journals, activities, mood tracking, water tracking,
checklists, photos, pomodoro sessions, friends, pen-pal messaging, and notifications.

All tables are owner-scoped (multi-user, sign-in required). Each table has a `user_id`
column defaulting to `auth.uid()` so client inserts that omit `user_id` still satisfy
the INSERT policy's WITH CHECK constraint.

## New Tables

1. **profiles** — public profile data for each user (username, bio, avatar, streak).
2. **friends** — accepted friendship relationships (bidirectional).
3. **friend_requests** — pending friend requests between users.
4. **journals** — a daily journal entry. One per user per day (unique constraint).
5. **activities** — scheduled activities/events.
6. **checklist_items** — checklist items belonging to a journal.
7. **mood_entries** — mood tracking per day (1-5 scale).
8. **water_entries** — water intake tracking (glasses per day).
9. **photos** — photo uploads attached to a journal entry.
10. **pomodoro_sessions** — pomodoro timer sessions.
11. **pen_pal_messages** — asynchronous letter-style messages between friends.
12. **notifications** — in-app notifications.
13. **journal_likes** — likes on public journals.
14. **journal_comments** — comments on public journals.
15. **journal_saves** — saved (bookmarked) public journals.

## Security
- RLS enabled on every table.
- Owner-scoped CRUD policies scoped to `authenticated`.
- Public journals readable by all authenticated users; private only by owner.
- Friends-only journals readable by accepted friends.
- Pen pal messages only between accepted friends.
- `user_id` columns default to `auth.uid()`.

## Important Notes
1. Profiles auto-created via trigger on auth.users insert.
2. Unique constraint on (user_id, journal_date) enforces one journal per day.
3. Friend requests use status: 'pending' | 'accepted' | 'rejected'.
*/

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  bio text,
  avatar_url text,
  streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_journal_date date,
  join_date timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================================
-- FRIENDS (accepted friendships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_friends" ON friends;
CREATE POLICY "select_own_friends" ON friends FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "insert_own_friends" ON friends;
CREATE POLICY "insert_own_friends" ON friends FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_friends" ON friends;
CREATE POLICY "delete_own_friends" ON friends FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================================================
-- FRIEND REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_friend_requests" ON friend_requests;
CREATE POLICY "select_own_friend_requests" ON friend_requests FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "insert_own_friend_requests" ON friend_requests;
CREATE POLICY "insert_own_friend_requests" ON friend_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "update_own_friend_requests" ON friend_requests;
CREATE POLICY "update_own_friend_requests" ON friend_requests FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

DROP POLICY IF EXISTS "delete_own_friend_requests" ON friend_requests;
CREATE POLICY "delete_own_friend_requests" ON friend_requests FOR DELETE
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============================================================================
-- JOURNALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_date date NOT NULL,
  what_happened text,
  what_i_learned text,
  what_to_improve text,
  grateful_for text,
  free_notes text,
  motivation_quote text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','friends','public')),
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, journal_date)
);

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journals" ON journals;
CREATE POLICY "select_own_journals" ON journals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_public_journals" ON journals;
CREATE POLICY "select_public_journals" ON journals FOR SELECT
  TO authenticated USING (visibility = 'public');

DROP POLICY IF EXISTS "select_friends_journals" ON journals;
CREATE POLICY "select_friends_journals" ON journals FOR SELECT
  TO authenticated USING (
    visibility = 'friends' AND EXISTS (
      SELECT 1 FROM friends
      WHERE (friends.user_id = auth.uid() AND friends.friend_id = journals.user_id)
         OR (friends.friend_id = auth.uid() AND friends.user_id = journals.user_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_journals" ON journals;
CREATE POLICY "insert_own_journals" ON journals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journals" ON journals;
CREATE POLICY "update_own_journals" ON journals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journals" ON journals;
CREATE POLICY "delete_own_journals" ON journals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- ACTIVITIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  color text NOT NULL DEFAULT '#0000FF',
  reminder_minutes integer,
  recurring_rule text,
  category text,
  is_completed boolean NOT NULL DEFAULT false,
  google_calendar_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_activities" ON activities;
CREATE POLICY "select_own_activities" ON activities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_activities" ON activities;
CREATE POLICY "insert_own_activities" ON activities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_activities" ON activities;
CREATE POLICY "update_own_activities" ON activities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activities" ON activities;
CREATE POLICY "delete_own_activities" ON activities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- CHECKLIST ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_id uuid REFERENCES journals(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_checklist" ON checklist_items;
CREATE POLICY "select_own_checklist" ON checklist_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_checklist" ON checklist_items;
CREATE POLICY "insert_own_checklist" ON checklist_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_checklist" ON checklist_items;
CREATE POLICY "update_own_checklist" ON checklist_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_checklist" ON checklist_items;
CREATE POLICY "delete_own_checklist" ON checklist_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- MOOD ENTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_date date NOT NULL,
  mood integer NOT NULL CHECK (mood BETWEEN 1 AND 5),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mood_date)
);

ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_mood" ON mood_entries;
CREATE POLICY "select_own_mood" ON mood_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_mood" ON mood_entries;
CREATE POLICY "insert_own_mood" ON mood_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_mood" ON mood_entries;
CREATE POLICY "update_own_mood" ON mood_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_mood" ON mood_entries;
CREATE POLICY "delete_own_mood" ON mood_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- WATER ENTRIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS water_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  water_date date NOT NULL,
  glasses integer NOT NULL DEFAULT 0,
  goal_glasses integer NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, water_date)
);

ALTER TABLE water_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_water" ON water_entries;
CREATE POLICY "select_own_water" ON water_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_water" ON water_entries;
CREATE POLICY "insert_own_water" ON water_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_water" ON water_entries;
CREATE POLICY "update_own_water" ON water_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_water" ON water_entries;
CREATE POLICY "delete_own_water" ON water_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- PHOTOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_id uuid REFERENCES journals(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_photos" ON photos;
CREATE POLICY "select_own_photos" ON photos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_photos" ON photos;
CREATE POLICY "insert_own_photos" ON photos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_photos" ON photos;
CREATE POLICY "update_own_photos" ON photos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_photos" ON photos;
CREATE POLICY "delete_own_photos" ON photos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- POMODORO SESSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type text NOT NULL DEFAULT 'work' CHECK (session_type IN ('work','short_break','long_break')),
  duration_minutes integer NOT NULL DEFAULT 25,
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pomodoro" ON pomodoro_sessions;
CREATE POLICY "select_own_pomodoro" ON pomodoro_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_pomodoro" ON pomodoro_sessions;
CREATE POLICY "insert_own_pomodoro" ON pomodoro_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_pomodoro" ON pomodoro_sessions;
CREATE POLICY "delete_own_pomodoro" ON pomodoro_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- PEN PAL MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pen_pal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  image_path text,
  shared_journal_id uuid REFERENCES journals(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pen_pal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_pen_pal" ON pen_pal_messages;
CREATE POLICY "select_own_pen_pal" ON pen_pal_messages FOR SELECT
  TO authenticated USING (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND EXISTS (
      SELECT 1 FROM friends
      WHERE (friends.user_id = pen_pal_messages.sender_id AND friends.friend_id = pen_pal_messages.receiver_id)
         OR (friends.user_id = pen_pal_messages.receiver_id AND friends.friend_id = pen_pal_messages.sender_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_pen_pal" ON pen_pal_messages;
CREATE POLICY "insert_own_pen_pal" ON pen_pal_messages FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM friends
      WHERE (friends.user_id = pen_pal_messages.sender_id AND friends.friend_id = pen_pal_messages.receiver_id)
         OR (friends.user_id = pen_pal_messages.receiver_id AND friends.friend_id = pen_pal_messages.sender_id)
    )
  );

DROP POLICY IF EXISTS "update_own_pen_pal" ON pen_pal_messages;
CREATE POLICY "update_own_pen_pal" ON pen_pal_messages FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "delete_own_pen_pal" ON pen_pal_messages;
CREATE POLICY "delete_own_pen_pal" ON pen_pal_messages FOR DELETE
  TO authenticated USING (auth.uid() = sender_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- JOURNAL LIKES / COMMENTS / SAVES
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, user_id)
);

ALTER TABLE journal_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_journal_likes" ON journal_likes;
CREATE POLICY "select_journal_likes" ON journal_likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_journal_like" ON journal_likes;
CREATE POLICY "insert_own_journal_like" ON journal_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_like" ON journal_likes;
CREATE POLICY "delete_own_journal_like" ON journal_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS journal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_journal_comments" ON journal_comments;
CREATE POLICY "select_journal_comments" ON journal_comments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_journal_comment" ON journal_comments;
CREATE POLICY "insert_own_journal_comment" ON journal_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_comment" ON journal_comments;
CREATE POLICY "delete_own_journal_comment" ON journal_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS journal_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journal_id, user_id)
);

ALTER TABLE journal_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saves" ON journal_saves;
CREATE POLICY "select_own_saves" ON journal_saves FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_save" ON journal_saves;
CREATE POLICY "insert_own_save" ON journal_saves FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_save" ON journal_saves;
CREATE POLICY "delete_own_save" ON journal_saves FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_journals_user_date ON journals(user_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_journals_visibility ON journals(visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_checklist_journal ON checklist_items(journal_id);
CREATE INDEX IF NOT EXISTS idx_mood_user_date ON mood_entries(user_id, mood_date DESC);
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_entries(user_id, water_date DESC);
CREATE INDEX IF NOT EXISTS idx_photos_journal ON photos(journal_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_sessions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_req_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_pen_pal_receiver ON pen_pal_messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_likes_journal ON journal_likes(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_comments_journal ON journal_comments(journal_id, created_at);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_journals_updated_at ON journals;
CREATE TRIGGER trg_journals_updated_at BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_activities_updated_at ON activities;
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_friend_req_updated_at ON friend_requests;
CREATE TRIGGER trg_friend_req_updated_at BEFORE UPDATE ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, join_date)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), NULL, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();