-- Migration: Relax Onboarding Constraints for Incremental Saves
-- Date: 2024-02-22
-- Description: Makes columns nullable in onboarding tables to support multi-step forms where data is saved partially.

-- 1. Advertiser Onboarding
-- Make columns nullable that are not available in the first step
ALTER TABLE IF EXISTS public.advertiser_onboarding
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN industry DROP NOT NULL,
  ALTER COLUMN compliance_confirmed DROP NOT NULL,
  ALTER COLUMN understands_consent_model DROP NOT NULL,
  ALTER COLUMN understands_targeting_limits DROP NOT NULL,
  ALTER COLUMN understands_payout_rules DROP NOT NULL;

-- Set defaults for booleans to avoid null issues in logic
ALTER TABLE IF EXISTS public.advertiser_onboarding
  ALTER COLUMN compliance_confirmed SET DEFAULT FALSE,
  ALTER COLUMN understands_consent_model SET DEFAULT FALSE,
  ALTER COLUMN understands_targeting_limits SET DEFAULT FALSE,
  ALTER COLUMN understands_payout_rules SET DEFAULT FALSE,
  ALTER COLUMN first_campaign_created SET DEFAULT FALSE;


-- 2. Publisher Onboarding
-- Make columns nullable
ALTER TABLE IF EXISTS public.publisher_onboarding
  ALTER COLUMN platform_type DROP NOT NULL,
  ALTER COLUMN content_categories DROP NOT NULL,
  ALTER COLUMN integration_method DROP NOT NULL,
  ALTER COLUMN revenue_split DROP NOT NULL,
  ALTER COLUMN ad_density_cap DROP NOT NULL;

-- Set defaults
ALTER TABLE IF EXISTS public.publisher_onboarding
  ALTER COLUMN test_ad_served SET DEFAULT FALSE,
  ALTER COLUMN test_events_verified SET DEFAULT FALSE;


-- 3. User Onboarding
-- Make columns nullable
ALTER TABLE IF EXISTS public.user_onboarding
  ALTER COLUMN intent DROP NOT NULL,
  ALTER COLUMN allowed_categories DROP NOT NULL,
  ALTER COLUMN blocked_categories DROP NOT NULL,
  ALTER COLUMN format_preferences DROP NOT NULL,
  ALTER COLUMN payout_threshold DROP NOT NULL,
  ALTER COLUMN privacy_acknowledged DROP NOT NULL;

-- Set defaults
ALTER TABLE IF EXISTS public.user_onboarding
  ALTER COLUMN privacy_acknowledged SET DEFAULT FALSE,
  ALTER COLUMN allowed_categories SET DEFAULT '{}',
  ALTER COLUMN blocked_categories SET DEFAULT '{}',
  ALTER COLUMN format_preferences SET DEFAULT '{}';
