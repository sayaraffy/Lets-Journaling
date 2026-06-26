/*
# Security Fixes — Function EXECUTE & Avatars Listing

## Overview
Resolves remaining Supabase Security Advisor warnings:
1. "Public Can Execute SECURITY DEFINER Function" — `handle_new_user` and
   `update_updated_at_column` still had the default PUBLIC EXECUTE grant.
   The previous migration revoked from `anon` and `authenticated` but not
   from `PUBLIC` (the implicit role that includes everyone).
2. "Signed-In Users Can Execute SECURITY DEFINER Function" — same root cause.
3. "Public Bucket Allows Listing" — the `avatars` bucket had a broad SELECT
   policy on `storage.objects` (`bucket_id = 'avatars'`) that let any
   authenticated client LIST all avatar files in the bucket. Public buckets
   serve files via public URLs without needing a SELECT policy, so the broad
   policy only enables unnecessary enumeration.

## Changes

### 1. Revoke EXECUTE FROM PUBLIC on both functions
- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` removes the default grant
  that allowed anyone (including anon) to call the functions via RPC.
- Functions remain SECURITY DEFINER with `SET search_path = public` —
  they are trigger-only and cannot be invoked via `/rest/v1/rpc/...`.

### 2. Drop the broad avatars SELECT policy
- `DROP POLICY "Public read avatars" ON storage.objects` removes the
  listing capability. Public URL access for avatars continues to work
  because the bucket is `public = true` — Supabase serves public-bucket
  objects via their public URL without going through RLS.
- The frontend uses `getPublicUrl()` which does not require a SELECT
  policy on `storage.objects`.

## Security
- Neither function is callable via RPC by any role except the owner.
- Avatars can no longer be enumerated via the storage API; they remain
  accessible by public URL for display in the UI.

## Important Notes
- No data is lost. Avatar uploads/downloads via public URL are unaffected.
- The trigger on `auth.users` continues to work because triggers execute
  as the function owner, not via the PUBLIC grant.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;