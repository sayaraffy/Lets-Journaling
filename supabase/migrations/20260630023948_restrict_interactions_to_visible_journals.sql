/*
# Restrict likes/comments/saves to visible journals only

Previously, any authenticated user could like or comment on ANY journal,
including private journals they shouldn't see. This tightens the INSERT
policies to require that the journal is visible to the user (own, public,
or friends-only with an accepted friendship).
*/

-- Helper: a journal is visible to the current user if they own it,
-- it's public, or it's friends-only and they're friends with the owner.
-- We inline this check in each policy.

-- ===== journal_likes =====

DROP POLICY IF EXISTS "insert_own_journal_like" ON public.journal_likes;
CREATE POLICY "insert_own_journal_like" ON public.journal_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.journals j
      WHERE j.id = journal_likes.journal_id
      AND (
        j.user_id = auth.uid()
        OR j.visibility = 'public'
        OR (
          j.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.friends f
            WHERE (f.user_id = auth.uid() AND f.friend_id = j.user_id)
          )
        )
      )
    )
  );

-- ===== journal_comments =====

DROP POLICY IF EXISTS "insert_own_journal_comment" ON public.journal_comments;
CREATE POLICY "insert_own_journal_comment" ON public.journal_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.journals j
      WHERE j.id = journal_comments.journal_id
      AND (
        j.user_id = auth.uid()
        OR j.visibility = 'public'
        OR (
          j.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.friends f
            WHERE (f.user_id = auth.uid() AND f.friend_id = j.user_id)
          )
        )
      )
    )
  );

-- ===== journal_saves =====

DROP POLICY IF EXISTS "insert_own_save" ON public.journal_saves;
CREATE POLICY "insert_own_save" ON public.journal_saves
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.journals j
      WHERE j.id = journal_saves.journal_id
      AND (
        j.user_id = auth.uid()
        OR j.visibility = 'public'
        OR (
          j.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.friends f
            WHERE (f.user_id = auth.uid() AND f.friend_id = j.user_id)
          )
        )
      )
    )
  );
