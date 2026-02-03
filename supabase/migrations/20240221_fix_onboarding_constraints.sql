-- Fix onboarding tables to allow incremental updates
-- Remove NOT NULL constraints to allow step-by-step onboarding

-- Alter advertiser_onboarding to remove NOT NULL constraints
ALTER TABLE IF EXISTS public.advertiser_onboarding
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN industry DROP NOT NULL,
  ALTER COLUMN compliance_confirmed DROP NOT NULL,
  ALTER COLUMN understands_consent_model DROP NOT NULL,
  ALTER COLUMN understands_targeting_limits DROP NOT NULL,
  ALTER COLUMN understands_payout_rules DROP NOT NULL;

-- Set default values for boolean columns
ALTER TABLE IF EXISTS public.advertiser_onboarding
  ALTER COLUMN compliance_confirmed SET DEFAULT FALSE,
  ALTER COLUMN understands_consent_model SET DEFAULT FALSE,
  ALTER COLUMN understands_targeting_limits SET DEFAULT FALSE,
  ALTER COLUMN understands_payout_rules SET DEFAULT FALSE;

-- Alter publisher_onboarding to remove NOT NULL constraints
ALTER TABLE IF EXISTS public.publisher_onboarding
  ALTER COLUMN platform_type DROP NOT NULL;

-- Set default value for platform_type
ALTER TABLE IF EXISTS public.publisher_onboarding
  ALTER COLUMN platform_type SET DEFAULT 'web';

-- Add service role policies for the onboarding tables (if not already present)
-- This allows the edge function (using service key) to modify these tables

-- user_onboarding service role policy
DROP POLICY IF EXISTS "Service role full access user_onboarding" ON public.user_onboarding;
CREATE POLICY "Service role full access user_onboarding" ON public.user_onboarding
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- advertiser_onboarding service role policy
DROP POLICY IF EXISTS "Service role full access advertiser_onboarding" ON public.advertiser_onboarding;
CREATE POLICY "Service role full access advertiser_onboarding" ON public.advertiser_onboarding
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- publisher_onboarding service role policy
DROP POLICY IF EXISTS "Service role full access publisher_onboarding" ON public.publisher_onboarding;
CREATE POLICY "Service role full access publisher_onboarding" ON public.publisher_onboarding
  FOR ALL
  USING (true)
  WITH CHECK (true);
