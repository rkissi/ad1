-- Add onboarding columns to profiles
ALTER TABLE profiles
ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'not_started'
CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed'));

ALTER TABLE profiles
ADD COLUMN onboarding_step TEXT;

ALTER TABLE profiles
ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Role-specific onboarding tables

-- 1. User onboarding
CREATE TABLE user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
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
CREATE TABLE advertiser_onboarding (
  advertiser_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
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
CREATE TABLE publisher_onboarding (
  publisher_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
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

-- Add indexes for performance
CREATE INDEX idx_user_onboarding_intent ON user_onboarding(intent);
CREATE INDEX idx_advertiser_onboarding_industry ON advertiser_onboarding(industry);
CREATE INDEX idx_publisher_onboarding_platform_type ON publisher_onboarding(platform_type);

-- Add RLS policies (Basic ones to allow user access to their own data)
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertiser_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_onboarding ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own onboarding" ON user_onboarding
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding" ON user_onboarding
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" ON user_onboarding
  FOR UPDATE USING (auth.uid() = user_id);

-- Advertiser policies
CREATE POLICY "Advertisers can view own onboarding" ON advertiser_onboarding
  FOR SELECT USING (auth.uid() = advertiser_id);

CREATE POLICY "Advertisers can insert own onboarding" ON advertiser_onboarding
  FOR INSERT WITH CHECK (auth.uid() = advertiser_id);

CREATE POLICY "Advertisers can update own onboarding" ON advertiser_onboarding
  FOR UPDATE USING (auth.uid() = advertiser_id);

-- Publisher policies
CREATE POLICY "Publishers can view own onboarding" ON publisher_onboarding
  FOR SELECT USING (auth.uid() = publisher_id);

CREATE POLICY "Publishers can insert own onboarding" ON publisher_onboarding
  FOR INSERT WITH CHECK (auth.uid() = publisher_id);

CREATE POLICY "Publishers can update own onboarding" ON publisher_onboarding
  FOR UPDATE USING (auth.uid() = publisher_id);
