/*
# Add nested comment replies and journal shares table

1. Changes to existing tables
- `journal_comments`: Add `parent_comment_id` (uuid, nullable) for threaded/nested replies.
  Self-referencing FK to `journal_comments(id)` with ON DELETE CASCADE so deleting
  a parent comment also removes its replies.

2. New Tables
- `journal_shares`
  - `id` (uuid, PK)
  - `journal_id` (uuid, FK to journals, NOT NULL)
  - `user_id` (uuid, FK to auth.users, NOT NULL, DEFAULT auth.uid())
  - `platform` (text, nullable — tracks which platform was shared to: whatsapp, telegram, x, link, etc.)
  - `created_at` (timestamptz, DEFAULT now())
  - Unique constraint on (journal_id, user_id) to prevent duplicate share counts per user.

3. Security
- `journal_shares` has RLS enabled with owner-scoped CRUD policies (authenticated only).
- `journal_comments` RLS is already enabled; the new column does not change existing policies.

4. Indexes
- Index on `journal_comments.parent_comment_id` for efficient reply lookups.
- Index on `journal_shares.journal_id` for counting shares per journal.
*/

-- Add parent_comment_id to journal_comments for nested replies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_comments' AND column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE journal_comments ADD COLUMN parent_comment_id uuid REFERENCES journal_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_comments_parent ON journal_comments (parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_journal_comments_journal ON journal_comments (journal_id);

-- Create journal_shares table
CREATE TABLE IF NOT EXISTS journal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_shares" ON journal_shares;
CREATE POLICY "select_own_shares" ON journal_shares FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_shares" ON journal_shares;
CREATE POLICY "insert_own_shares" ON journal_shares FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_shares" ON journal_shares;
CREATE POLICY "delete_own_shares" ON journal_shares FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS journal_shares_journal_id_user_id_key ON journal_shares (journal_id, user_id);
CREATE INDEX IF NOT EXISTS idx_journal_shares_journal ON journal_shares (journal_id);
