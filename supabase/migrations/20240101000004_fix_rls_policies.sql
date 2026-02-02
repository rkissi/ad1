-- Fix RLS policies to prevent infinite recursion
-- The issue is that policies on 'profiles' table were referencing 'profiles' table itself

-- First, drop all existing problematic policies on profiles
DROP POLICY IF EXISTS users_can_view_their_own_profile ON public.profiles;
DROP POLICY IF EXISTS users_can_update_their_own_profile ON public.profiles;
DROP POLICY IF EXISTS admins_can_view_all_profiles ON public.profiles;
DROP POLICY IF EXISTS public_profiles_are_viewable ON public.profiles;
DROP POLICY IF EXISTS service_role_insert_profiles ON public.profiles;

-- Also drop other problematic policies that reference profiles
DROP POLICY IF EXISTS admins_manage_all_campaigns ON public.campaigns;
DROP POLICY IF EXISTS admins_view_all_advertisers ON public.advertisers;
DROP POLICY IF EXISTS admins_manage_settings ON public.platform_settings;

-- Create a helper function to check admin role that doesn't cause recursion
-- This uses auth.jwt() to get the role from JWT metadata instead of querying profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_meta jsonb;
BEGIN
  user_meta := COALESCE(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  RETURN user_meta ->> 'role' = 'admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a helper function to get current user role from JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_meta jsonb;
BEGIN
  user_meta := COALESCE(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  RETURN COALESCE(user_meta ->> 'role', 'user');
EXCEPTION WHEN OTHERS THEN
  RETURN 'user';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate profiles policies without self-referencing queries

-- Allow users to view their own profile
CREATE POLICY users_can_view_their_own_profile ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile  
CREATE POLICY users_can_update_their_own_profile ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow service role (triggers) to insert profiles - critical for registration
CREATE POLICY service_role_insert_profiles ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Allow admins to view all profiles using JWT role check (no table self-reference)
CREATE POLICY admins_can_view_all_profiles ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Recreate campaigns admin policy
CREATE POLICY admins_manage_all_campaigns ON public.campaigns
  FOR ALL USING (public.is_admin());

-- Recreate advertisers admin policy  
CREATE POLICY admins_view_all_advertisers ON public.advertisers
  FOR SELECT USING (public.is_admin());

-- Recreate platform_settings admin policy
CREATE POLICY admins_manage_settings ON public.platform_settings
  FOR ALL USING (public.is_admin());

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;
