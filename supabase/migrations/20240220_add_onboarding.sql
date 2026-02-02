-- Add onboarding columns to profiles only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'profiles'
      AND n.nspname = 'public'
      AND a.attname = 'onboarding_status'
      AND a.attnum > 0
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'profiles'
      AND n.nspname = 'public'
      AND a.attname = 'onboarding_step'
      AND a.attnum > 0
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN onboarding_step TEXT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'profiles'
      AND n.nspname = 'public'
      AND a.attname = 'onboarding_completed_at'
      AND a.attnum > 0
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END
$$;


-- Role-specific onboarding tables
-- 1. User onboarding
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  intent TEXT,
  allowed_categories TEXT[],
  blocked_categories TEXT[],
  min_reward_per_category JSONB,
  frequency_caps JSONB,
  format_preferences TEXT[],
  payout_threshold NUMERIC,
  privacy_acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Advertiser onboarding
CREATE TABLE IF NOT EXISTS public.advertiser_onboarding (
  advertiser_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  compliance_confirmed BOOLEAN NOT NULL,
  understands_consent_model BOOLEAN NOT NULL,
  understands_targeting_limits BOOLEAN NOT NULL,
  understands_payout_rules BOOLEAN NOT NULL,
  first_campaign_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Publisher onboarding
CREATE TABLE IF NOT EXISTS public.publisher_onboarding (
  publisher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL,
  content_categories TEXT[],
  integration_method TEXT CHECK (integration_method IN ('sdk', 'api')),
  revenue_split NUMERIC CHECK (revenue_split BETWEEN 0 AND 1),
  ad_density_cap INTEGER,
  test_ad_served BOOLEAN DEFAULT FALSE,
  test_events_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- Add indexes for performance (only if they don't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'idx_user_onboarding_intent'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_user_onboarding_intent ON public.user_onboarding(intent);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'idx_advertiser_onboarding_industry'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_advertiser_onboarding_industry ON public.advertiser_onboarding(industry);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'idx_publisher_onboarding_platform_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_publisher_onboarding_platform_type ON public.publisher_onboarding(platform_type);
  END IF;
END
$$;


-- Enable Row Level Security on the onboarding tables (safe if already enabled)
ALTER TABLE IF EXISTS public.user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.advertiser_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.publisher_onboarding ENABLE ROW LEVEL SECURITY;


-- Helper: function to check if a policy exists
CREATE OR REPLACE FUNCTION public.policy_exists(rel regclass, policy_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = split_part(rel::text, '.', 1)
      AND tablename = split_part(rel::text, '.', 2)
      AND policyname = policy_name
  );
$$;

-- Create policies only if they don't exist

-- User policies
DO $$
BEGIN
  IF NOT public.policy_exists('public.user_onboarding', 'Users can view own onboarding') THEN
    CREATE POLICY "Users can view own onboarding" ON public.user_onboarding
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT public.policy_exists('public.user_onboarding', 'Users can insert own onboarding') THEN
    CREATE POLICY "Users can insert own onboarding" ON public.user_onboarding
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT public.policy_exists('public.user_onboarding', 'Users can update own onboarding') THEN
    CREATE POLICY "Users can update own onboarding" ON public.user_onboarding
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Advertiser policies
DO $$
BEGIN
  IF NOT public.policy_exists('public.advertiser_onboarding', 'Advertisers can view own onboarding') THEN
    CREATE POLICY "Advertisers can view own onboarding" ON public.advertiser_onboarding
      FOR SELECT USING (auth.uid() = advertiser_id);
  END IF;

  IF NOT public.policy_exists('public.advertiser_onboarding', 'Advertisers can insert own onboarding') THEN
    CREATE POLICY "Advertisers can insert own onboarding" ON public.advertiser_onboarding
      FOR INSERT WITH CHECK (auth.uid() = advertiser_id);
  END IF;

  IF NOT public.policy_exists('public.advertiser_onboarding', 'Advertisers can update own onboarding') THEN
    CREATE POLICY "Advertisers can update own onboarding" ON public.advertiser_onboarding
      FOR UPDATE USING (auth.uid() = advertiser_id);
  END IF;
END
$$;

-- Publisher policies
DO $$
BEGIN
  IF NOT public.policy_exists('public.publisher_onboarding', 'Publishers can view own onboarding') THEN
    CREATE POLICY "Publishers can view own onboarding" ON public.publisher_onboarding
      FOR SELECT USING (auth.uid() = publisher_id);
  END IF;

  IF NOT public.policy_exists('public.publisher_onboarding', 'Publishers can insert own onboarding') THEN
    CREATE POLICY "Publishers can insert own onboarding" ON public.publisher_onboarding
      FOR INSERT WITH CHECK (auth.uid() = publisher_id);
  END IF;

  IF NOT public.policy_exists('public.publisher_onboarding', 'Publishers can update own onboarding') THEN
    CREATE POLICY "Publishers can update own onboarding" ON public.publisher_onboarding
      FOR UPDATE USING (auth.uid() = publisher_id);
  END IF;
END
$$;

-- Clean up helper function (optional). If you want to keep it, comment out the following DROP.
DROP FUNCTION IF EXISTS public.policy_exists(regclass, text);