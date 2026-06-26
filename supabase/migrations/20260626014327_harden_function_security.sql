/*
# Security Hardening — Function Search Path & EXECUTE Permissions

## Overview
Addresses Supabase Security Advisor warnings:
1. "Function Search Path Mutable" — `update_updated_at_column` and `handle_new_user` lacked
   an explicit `SET search_path`, making them vulnerable to search-path hijacking.
2. "Unnecessary SECURITY DEFINER execution permissions" — trigger-only functions were
   callable via RPC by `anon` and `authenticated` roles.

## Changes

### 1. update_updated_at_column
- Recreated with `SET search_path = public` inside the function body.
- This function is only used by triggers; it should never be called via RPC.
- Revoked EXECUTE from `anon` and `authenticated`.

### 2. handle_new_user
- Recreated with `SET search_path = public` inside the function body.
- This function is only used by the `on_auth_user_created` trigger; it should never be called via RPC.
- Revoked EXECUTE from `anon` and `authenticated`.

## Security
- Both functions remain SECURITY DEFINER (required for trigger on auth.users to insert into public.profiles).
- Explicit `search_path = public` prevents an attacker from shadowing `public.profiles` with a malicious schema.
- Revoking EXECUTE prevents direct RPC calls that could bypass the intended trigger-only usage.

## Important Notes
- The trigger definitions are preserved (dropped and recreated to rebind to the new function versions).
- No data is lost; functions are recreated idempotently.
*/

-- ============================================================================
-- 1. update_updated_at_column — hardened
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- Rebind triggers to the new function version
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_journals_updated_at ON public.journals;
CREATE TRIGGER trg_journals_updated_at BEFORE UPDATE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_activities_updated_at ON public.activities;
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_friend_req_updated_at ON public.friend_requests;
CREATE TRIGGER trg_friend_req_updated_at BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. handle_new_user — hardened
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, join_date)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), NULL, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();