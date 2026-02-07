-- Metaverse Advertising Platform - Unified Policies
-- Single Source of Truth for RLS Policies

-- ==========================================
-- 1. ENABLE RLS
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publisher_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_controls ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 2. HELPER FUNCTIONS
-- ==========================================

-- Helper to check if user is admin via JWT metadata (prevents recursion)
-- Helper functions are defined in separate migrations (e.g., 20240524_rbac_helpers.sql)
-- but for completeness in this baseline file, we can include the secure definition here if this file is run first.
-- However, we assume the helper migration is applied or we redefine it here securely.

-- Secure is_admin implementation (idempotent if already defined securely)
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

-- ==========================================
-- 3. POLICIES
-- ==========================================

-- PROFILES
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_admin_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY profiles_admin_select ON public.profiles
        FOR SELECT USING (
          public.is_admin()
          OR id = auth.uid()
        );
    $sql$;
  END IF;
END;
$$;

-- User Access (Update own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_user_update'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY profiles_user_update ON public.profiles
        FOR UPDATE USING (id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- NOTE: Public access to profiles is disabled for security (PII protection).
-- If public profile viewing is required, create a secure view exposing only non-sensitive data.

-- Service Role (Insert for auth trigger)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_service_role_insert'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY profiles_service_role_insert ON public.profiles
        FOR INSERT WITH CHECK (true);
    $sql$;
  END IF;
END;
$$;

-- CAMPAIGNS
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'campaigns_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY campaigns_admin_all ON public.campaigns
        FOR ALL USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- Advertiser Access (Manage own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'campaigns_advertiser_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY campaigns_advertiser_all ON public.campaigns
        FOR ALL USING (advertiser_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- Public Access (View active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'campaigns' AND policyname = 'campaigns_public_select_active'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY campaigns_public_select_active ON public.campaigns
        FOR SELECT USING (status = 'active');
    $sql$;
  END IF;
END;
$$;

-- ADVERTISERS
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advertisers' AND policyname = 'advertisers_admin_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY advertisers_admin_select ON public.advertisers
        FOR SELECT USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- Advertiser Access (Manage own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advertisers' AND policyname = 'advertisers_user_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY advertisers_user_all ON public.advertisers
        FOR ALL USING (user_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- PUBLISHERS
-- Admin Access (Consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'publishers' AND policyname = 'publishers_admin_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY publishers_admin_select ON public.publishers
        FOR SELECT USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- Publisher Access (Manage own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'publishers' AND policyname = 'publishers_user_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY publishers_user_all ON public.publishers
        FOR ALL USING (user_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- NOTE: Public access to publishers is disabled for security (API Key protection).
-- If public publisher listing is required, create a secure view exposing only non-sensitive data.

-- CONSENTS
-- User Access (Manage own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'consents' AND policyname = 'consents_user_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY consents_user_all ON public.consents
        FOR ALL USING (user_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- EVENTS
-- User Access (View own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_user_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY events_user_select ON public.events
        FOR SELECT USING (user_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- Publisher Access (View derived)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_publisher_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY events_publisher_select ON public.events
        FOR SELECT USING (
          publisher_id IN (
            SELECT id FROM public.publishers WHERE user_id = auth.uid()
          )
        );
    $sql$;
  END IF;
END;
$$;

-- Advertiser Access (View derived)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_advertiser_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY events_advertiser_select ON public.events
        FOR SELECT USING (
          campaign_id IN (
            SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid()
          )
        );
    $sql$;
  END IF;
END;
$$;

-- Service Role (Insert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_service_role_insert'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY events_service_role_insert ON public.events
        FOR INSERT WITH CHECK (true);
    $sql$;
  END IF;
END;
$$;

-- TRANSACTIONS
-- User Access (View involved)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'transactions' AND policyname = 'transactions_user_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY transactions_user_select ON public.transactions
        FOR SELECT USING (
          from_user_id = auth.uid() OR to_user_id = auth.uid()
        );
    $sql$;
  END IF;
END;
$$;

-- USER REWARDS
-- User Access (View own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_rewards' AND policyname = 'user_rewards_user_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY user_rewards_user_select ON public.user_rewards
        FOR SELECT USING (user_id = auth.uid());
    $sql$;
  END IF;
END;
$$;

-- AD CREATIVES
-- Public Access (View active)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ad_creatives' AND policyname = 'ad_creatives_public_select_active'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ad_creatives_public_select_active ON public.ad_creatives
        FOR SELECT USING (is_active = true);
    $sql$;
  END IF;
END;
$$;

-- Advertiser Access (Manage derived)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ad_creatives' AND policyname = 'ad_creatives_advertiser_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY ad_creatives_advertiser_all ON public.ad_creatives
        FOR ALL USING (
          campaign_id IN (
            SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid()
          )
        );
    $sql$;
  END IF;
END;
$$;

-- PLATFORM SETTINGS
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'platform_settings_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY platform_settings_admin_all ON public.platform_settings
        FOR ALL USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- Public Access (View all)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'platform_settings_public_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY platform_settings_public_select ON public.platform_settings
        FOR SELECT USING (true);
    $sql$;
  END IF;
END;
$$;

-- CONSENT AUDIT LOG
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'consent_audit_log' AND policyname = 'consent_audit_log_admin_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY consent_audit_log_admin_select ON public.consent_audit_log
        FOR SELECT USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- PUBLISHER TRUST SCORES
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'publisher_trust_scores' AND policyname = 'publisher_trust_scores_admin_select'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY publisher_trust_scores_admin_select ON public.publisher_trust_scores
        FOR SELECT USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- EMERGENCY CONTROLS
-- Admin Access (from ...05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'emergency_controls' AND policyname = 'emergency_controls_admin_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY emergency_controls_admin_all ON public.emergency_controls
        FOR ALL USING (
          public.is_admin()
        );
    $sql$;
  END IF;
END;
$$;

-- FRAUD SESSIONS
-- Service Role Only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fraud_sessions' AND policyname = 'fraud_sessions_service_role'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY fraud_sessions_service_role ON public.fraud_sessions
        FOR ALL USING (auth.role() = 'service_role');
    $sql$;
  END IF;
END;
$$;

-- BLOCKED ENTITIES
-- Service Role Only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blocked_entities' AND policyname = 'blocked_entities_service_role'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY blocked_entities_service_role ON public.blocked_entities
        FOR ALL USING (auth.role() = 'service_role');
    $sql$;
  END IF;
END;
$$;