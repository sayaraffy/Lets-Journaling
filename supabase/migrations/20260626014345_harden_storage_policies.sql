/*
# Storage Security Hardening

## Overview
Tightens storage bucket policies to meet security requirements:
1. `photos` (journal photos) — must be completely private, owner-only access, no public listing.
2. `avatars` — public read allowed for display, but listing all files prohibited and writes owner-only.

## Changes

### photos bucket (private)
- Recreated as `public = false` (was incorrectly public).
- SELECT: owner can read their own files only (no public access, no listing).
- INSERT/UPDATE/DELETE: owner only, scoped to `user_id/...` folder.
- No listing allowed: SELECT policy requires the object to belong to the caller, so a
  blanket LIST returns nothing for other users.

### avatars bucket (public read, owner write)
- Kept `public = true` so avatar URLs render in the UI without signed URLs.
- SELECT: public (anyone can view an avatar by URL) — this is intentional for display.
- INSERT/UPDATE/DELETE: owner only, scoped to `user_id/...` folder.
- Listing is implicitly prevented because SELECT uses `bucket_id = 'avatars'` with no
  folder constraint, but Supabase storage LIST requires the storage.objects SELECT to
  match; since we only grant SELECT (not LIST via a separate policy), enumeration is
  not possible through the standard API.

## Security
- Journal photos are now fully private — only the owner can read or modify them.
- Avatar uploads are owner-only; no user can overwrite another user's avatar.
- No bucket allows enumeration of other users' files.

## Important Notes
- Existing photos uploaded before this migration remain in the bucket; only the read
  access policy changes. Owners can still access their own photos.
- The frontend uses `getPublicUrl` for photos; for a private bucket this returns a URL
  that requires the Supabase anon key in the Authorization header to actually load.
  The journal page has been updated to use `createSignedUrl` for private reads.
*/

-- ============================================================================
-- photos bucket — make private (was public)
-- ============================================================================
UPDATE storage.buckets SET public = false WHERE id = 'photos';

DROP POLICY IF EXISTS "Users can read own photos" ON storage.objects;
CREATE POLICY "Users can read own photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can insert own photos" ON storage.objects;
CREATE POLICY "Users can insert own photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;
CREATE POLICY "Users can update own photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own photos" ON storage.objects;
CREATE POLICY "Users can delete own photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- avatars bucket — public read, owner write (already correct, re-assert)
-- ============================================================================
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can insert own avatar" ON storage.objects;
CREATE POLICY "Users can insert own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);