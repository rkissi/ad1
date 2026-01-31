BEGIN;

-- 1. Ensure enum exists in PUBLIC schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM (
      'user',
      'advertiser',
      'publisher',
      'admin'
    );
  END IF;
END
$$;

-- 2. Ensure enum values exist (Postgres 14+)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'advertiser';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'publisher';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- 3. DROP policies that reference the role column
-- (These are from the list you provided. We drop them so ALTER COLUMN can run.)

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can view all advertisers" ON public.advertisers;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can view consent audit log" ON public.consent_audit_log;
DROP POLICY IF EXISTS "Admins can view all trust scores" ON public.publisher_trust_scores;
DROP POLICY IF EXISTS "Only admins can manage emergency controls" ON public.emergency_controls;

-- Service-role policies do not reference 'role' column so no drop necessary:
-- "Service role only access fraud_sessions"
-- "Service role only access blocked_entities"

-- Duplicate/alternate-named admin policies (also drop)
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_manage_all_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "admins_view_all_advertisers" ON public.advertisers;
DROP POLICY IF EXISTS "admins_manage_settings" ON public.platform_settings;

-- 4. Alter the profiles.role column to use the new enum type
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.user_role
  USING role::text::public.user_role;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

-- 5. Recreate the previously dropped policies with the same USING clauses
-- (Make sure these match the originals exactly)

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles profiles_1
      WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Admins can manage all campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Admins can view all advertisers" ON public.advertisers
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Admins can view consent audit log" ON public.consent_audit_log
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Admins can view all trust scores" ON public.publisher_trust_scores
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "Only admins can manage emergency controls" ON public.emergency_controls
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

-- Recreate duplicate/alternate-named policies as they were listed
CREATE POLICY "admins_can_view_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles profiles_1
      WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "admins_manage_all_campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "admins_view_all_advertisers" ON public.advertisers
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

CREATE POLICY "admins_manage_settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (
    (EXISTS (
      SELECT 1
      FROM profiles
      WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::user_role))
    ))
  );

-- 6. Ensure the service_role-based policies (they do not use profile.role) still exist:
-- recreate them if needed (no role-column dependency):

DROP POLICY IF EXISTS "Service role only access fraud_sessions" ON public.fraud_sessions;
CREATE POLICY "Service role only access fraud_sessions" ON public.fraud_sessions
  FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);

DROP POLICY IF EXISTS "Service role only access blocked_entities" ON public.blocked_entities;
CREATE POLICY "Service role only access blocked_entities" ON public.blocked_entities
  FOR ALL TO PUBLIC
  USING (auth.role() = 'service_role'::text);

-- 7. DROP broken trigger + function (critical)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 8. Recreate SAFE, DEFENSIVE signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role public.user_role := 'user';
BEGIN
  -- Safely resolve role (never crash)
  IF NEW.raw_user_meta_data ? 'role' THEN
    BEGIN
      resolved_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      resolved_role := 'user';
    END;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    did,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    'did:metaverse:' || NEW.id::text,
    resolved_role
  );

  RETURN NEW;
END;
$$;

-- 9. Recreate trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

COMMIT;