-- Migration to update RLS policies to use secure RBAC functions
-- Replaces auth.jwt() ->> 'role' with public.is_admin()

-- 1. Ensure helper functions exist (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- 2. Update Policies

-- PROFILES
DROP POLICY IF EXISTS profiles_admin_select ON public.profiles;
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT USING (
    public.is_admin()
    OR id = auth.uid()
  );

-- CAMPAIGNS
DROP POLICY IF EXISTS campaigns_admin_all ON public.campaigns;
CREATE POLICY campaigns_admin_all ON public.campaigns
  FOR ALL USING (
    public.is_admin()
  );

-- ADVERTISERS
DROP POLICY IF EXISTS advertisers_admin_select ON public.advertisers;
CREATE POLICY advertisers_admin_select ON public.advertisers
  FOR SELECT USING (
    public.is_admin()
  );

-- PUBLISHERS
DROP POLICY IF EXISTS publishers_admin_select ON public.publishers;
CREATE POLICY publishers_admin_select ON public.publishers
  FOR SELECT USING (
    public.is_admin()
  );

-- PLATFORM SETTINGS
DROP POLICY IF EXISTS platform_settings_admin_all ON public.platform_settings;
CREATE POLICY platform_settings_admin_all ON public.platform_settings
  FOR ALL USING (
    public.is_admin()
  );

-- CONSENT AUDIT LOG
DROP POLICY IF EXISTS consent_audit_log_admin_select ON public.consent_audit_log;
CREATE POLICY consent_audit_log_admin_select ON public.consent_audit_log
  FOR SELECT USING (
    public.is_admin()
  );

-- PUBLISHER TRUST SCORES
DROP POLICY IF EXISTS publisher_trust_scores_admin_select ON public.publisher_trust_scores;
CREATE POLICY publisher_trust_scores_admin_select ON public.publisher_trust_scores
  FOR SELECT USING (
    public.is_admin()
  );

-- EMERGENCY CONTROLS
DROP POLICY IF EXISTS emergency_controls_admin_all ON public.emergency_controls;
CREATE POLICY emergency_controls_admin_all ON public.emergency_controls
  FOR ALL USING (
    public.is_admin()
  );
