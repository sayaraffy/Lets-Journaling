/*
# Allow reading photos attached to public journals

The photos table RLS only allows reading own photos. For public journals,
other users need to see the attached photos. This adds a SELECT policy
that allows reading photos where the linked journal has visibility='public'.
*/

DROP POLICY IF EXISTS "select_public_journal_photos" ON public.photos;
CREATE POLICY "select_public_journal_photos" ON public.photos
  FOR SELECT TO authenticated
  USING (
    journal_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.journals j
      WHERE j.id = photos.journal_id
      AND j.visibility = 'public'
    )
  );
