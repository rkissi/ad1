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
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. POLICIES
-- ==========================================

-- PROFILES
-- Admin Access (from ...05)
CREATE POLICY profiles_admin_select ON public.profiles
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
    OR id = auth.uid()
  );

-- User Access (Update own)
CREATE POLICY profiles_user_update ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- NOTE: Public access to profiles is disabled for security (PII protection).
-- If public profile viewing is required, create a secure view exposing only non-sensitive data.

-- Service Role (Insert for auth trigger)
CREATE POLICY profiles_service_role_insert ON public.profiles
  FOR INSERT WITH CHECK (true);

-- CAMPAIGNS
-- Admin Access (from ...05)
CREATE POLICY campaigns_admin_all ON public.campaigns
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Advertiser Access (Manage own)
CREATE POLICY campaigns_advertiser_all ON public.campaigns
  FOR ALL USING (advertiser_id = auth.uid());

-- Public Access (View active)
CREATE POLICY campaigns_public_select_active ON public.campaigns
  FOR SELECT USING (status = 'active');

-- ADVERTISERS
-- Admin Access (from ...05)
CREATE POLICY advertisers_admin_select ON public.advertisers
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Advertiser Access (Manage own)
CREATE POLICY advertisers_user_all ON public.advertisers
  FOR ALL USING (user_id = auth.uid());

-- PUBLISHERS
-- Admin Access (Consistency)
CREATE POLICY publishers_admin_select ON public.publishers
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Publisher Access (Manage own)
CREATE POLICY publishers_user_all ON public.publishers
  FOR ALL USING (user_id = auth.uid());

-- NOTE: Public access to publishers is disabled for security (API Key protection).
-- If public publisher listing is required, create a secure view exposing only non-sensitive data.

-- CONSENTS
-- User Access (Manage own)
CREATE POLICY consents_user_all ON public.consents
  FOR ALL USING (user_id = auth.uid());

-- EVENTS
-- User Access (View own)
CREATE POLICY events_user_select ON public.events
  FOR SELECT USING (user_id = auth.uid());

-- Publisher Access (View derived)
CREATE POLICY events_publisher_select ON public.events
  FOR SELECT USING (
    publisher_id IN (
      SELECT id FROM public.publishers WHERE user_id = auth.uid()
    )
  );

-- Advertiser Access (View derived)
CREATE POLICY events_advertiser_select ON public.events
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid()
    )
  );

-- Service Role (Insert)
CREATE POLICY events_service_role_insert ON public.events
  FOR INSERT WITH CHECK (true);

-- TRANSACTIONS
-- User Access (View involved)
CREATE POLICY transactions_user_select ON public.transactions
  FOR SELECT USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid()
  );

-- USER REWARDS
-- User Access (View own)
CREATE POLICY user_rewards_user_select ON public.user_rewards
  FOR SELECT USING (user_id = auth.uid());

-- AD CREATIVES
-- Public Access (View active)
CREATE POLICY ad_creatives_public_select_active ON public.ad_creatives
  FOR SELECT USING (is_active = true);

-- Advertiser Access (Manage derived)
CREATE POLICY ad_creatives_advertiser_all ON public.ad_creatives
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid()
    )
  );

-- PLATFORM SETTINGS
-- Admin Access (from ...05)
CREATE POLICY platform_settings_admin_all ON public.platform_settings
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- Public Access (View all)
CREATE POLICY platform_settings_public_select ON public.platform_settings
  FOR SELECT USING (true);

-- CONSENT AUDIT LOG
-- Admin Access (from ...05)
CREATE POLICY consent_audit_log_admin_select ON public.consent_audit_log
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- PUBLISHER TRUST SCORES
-- Admin Access (from ...05)
CREATE POLICY publisher_trust_scores_admin_select ON public.publisher_trust_scores
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- EMERGENCY CONTROLS
-- Admin Access (from ...05)
CREATE POLICY emergency_controls_admin_all ON public.emergency_controls
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'admin'
  );

-- FRAUD SESSIONS
-- Service Role Only
CREATE POLICY fraud_sessions_service_role ON public.fraud_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- BLOCKED ENTITIES
-- Service Role Only
CREATE POLICY blocked_entities_service_role ON public.blocked_entities
  FOR ALL USING (auth.role() = 'service_role');
