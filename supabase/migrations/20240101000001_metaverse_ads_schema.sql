-- Metaverse Advertising Platform Database Schema
-- Supabase Migration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types for better type safety (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user', 'advertiser', 'publisher', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE campaign_status AS ENUM ('draft', 'pending', 'active', 'paused', 'completed', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    CREATE TYPE event_type AS ENUM ('impression', 'click', 'conversion', 'view');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
  END IF;
END
$$;

-- (Optional) ensure enum contains labels - requires Postgres 14+ for IF NOT EXISTS on ADD VALUE
-- Remove these ALTER TYPE lines if your server is older than 14
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'advertiser';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'publisher';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'impression';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'click';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'conversion';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'view';

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'refunded';

ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'rejected';

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  did VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  role user_role DEFAULT 'user',
  interests TEXT[] DEFAULT '{}',
  reward_preferences JSONB DEFAULT '{}',
  consents JSONB DEFAULT '{}',
  pds_url VARCHAR(500),
  wallet_address VARCHAR(42),
  token_balance DECIMAL(18,6) DEFAULT 0,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  audience_spec JSONB DEFAULT '{}',
  budget DECIMAL(18,6) DEFAULT 0,
  spent DECIMAL(18,6) DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'USD',
  creative_manifest JSONB DEFAULT '{}',
  payout_rules JSONB DEFAULT '{"impressionPayout": 0.001, "clickPayout": 0.05, "conversionPayout": 2.00}',
  delivery_constraints JSONB DEFAULT '{}',
  status campaign_status DEFAULT 'draft',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0,
  blockchain_tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Publishers table
CREATE TABLE IF NOT EXISTS public.publishers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  description TEXT,
  categories TEXT[] DEFAULT '{}',
  ad_slots JSONB DEFAULT '[]',
  payout_preferences JSONB DEFAULT '{}',
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_earnings DECIMAL(18,6) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  api_key VARCHAR(64) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advertisers table
CREATE TABLE IF NOT EXISTS public.advertisers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  industry VARCHAR(100),
  website VARCHAR(500),
  verification_status verification_status DEFAULT 'pending',
  billing_info JSONB DEFAULT '{}',
  total_spent DECIMAL(18,6) DEFAULT 0,
  active_campaigns INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consents table
CREATE TABLE IF NOT EXISTS public.consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope VARCHAR(100) NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  signature VARCHAR(132),
  ipfs_hash VARCHAR(100),
  blockchain_tx_hash VARCHAR(66),
  is_active BOOLEAN DEFAULT true
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type event_type NOT NULL,
  ad_id VARCHAR(255),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  publisher_id UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  slot_id VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  reward_amount DECIMAL(18,6) DEFAULT 0,
  signature VARCHAR(132),
  ipfs_hash VARCHAR(100),
  blockchain_tx_hash VARCHAR(66)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount DECIMAL(18,6) NOT NULL,
  currency VARCHAR(20) DEFAULT 'USD',
  status transaction_status DEFAULT 'pending',
  blockchain_tx_hash VARCHAR(66),
  stripe_payment_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User rewards table
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount DECIMAL(18,6) NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  status transaction_status DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  blockchain_tx_hash VARCHAR(66),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ad creatives table
CREATE TABLE IF NOT EXISTS public.ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  image_url TEXT,
  video_url TEXT,
  cta_text VARCHAR(100),
  cta_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON public.campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON public.events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_publisher ON public.events(publisher_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON public.events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_consents_user ON public.consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_active ON public.consents(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON public.transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON public.transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON public.user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_publishers_user ON public.publishers(user_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_user ON public.advertisers(user_id);

-- Enable Row Level Security
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

-- Create RLS policies idempotently using DO blocks (CREATE POLICY has no IF NOT EXISTS)
-- Profiles policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_can_view_their_own_profile' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY users_can_view_their_own_profile ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_can_update_their_own_profile' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY users_can_update_their_own_profile ON public.profiles
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'admins_can_view_all_profiles' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY admins_can_view_all_profiles ON public.profiles
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'public_profiles_are_viewable' AND n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE POLICY public_profiles_are_viewable ON public.profiles
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Campaigns policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anyone_can_view_active_campaigns' AND n.nspname = 'public' AND c.relname = 'campaigns'
  ) THEN
    CREATE POLICY anyone_can_view_active_campaigns ON public.campaigns
      FOR SELECT USING (status = 'active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'advertisers_manage_their_campaigns' AND n.nspname = 'public' AND c.relname = 'campaigns'
  ) THEN
    CREATE POLICY advertisers_manage_their_campaigns ON public.campaigns
      FOR ALL USING (advertiser_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'admins_manage_all_campaigns' AND n.nspname = 'public' AND c.relname = 'campaigns'
  ) THEN
    CREATE POLICY admins_manage_all_campaigns ON public.campaigns
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END
$$;

-- Publishers policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'publishers_manage_their_own_data' AND n.nspname = 'public' AND c.relname = 'publishers'
  ) THEN
    CREATE POLICY publishers_manage_their_own_data ON public.publishers
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anyone_view_active_publishers' AND n.nspname = 'public' AND c.relname = 'publishers'
  ) THEN
    CREATE POLICY anyone_view_active_publishers ON public.publishers
      FOR SELECT USING (status = 'active');
  END IF;
END
$$;

-- Advertisers policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'advertisers_manage_their_own_data' AND n.nspname = 'public' AND c.relname = 'advertisers'
  ) THEN
    CREATE POLICY advertisers_manage_their_own_data ON public.advertisers
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'admins_view_all_advertisers' AND n.nspname = 'public' AND c.relname = 'advertisers'
  ) THEN
    CREATE POLICY admins_view_all_advertisers ON public.advertisers
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END
$$;

-- Consents policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_manage_their_own_consents' AND n.nspname = 'public' AND c.relname = 'consents'
  ) THEN
    CREATE POLICY users_manage_their_own_consents ON public.consents
      FOR ALL USING (user_id = auth.uid());
  END IF;
END
$$;

-- Events policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_view_their_own_events' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY users_view_their_own_events ON public.events
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'publishers_view_their_events' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY publishers_view_their_events ON public.events
      FOR SELECT USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'advertisers_view_campaign_events' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY advertisers_view_campaign_events ON public.events
      FOR SELECT USING (campaign_id IN (SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'service_role_insert_events' AND n.nspname = 'public' AND c.relname = 'events'
  ) THEN
    CREATE POLICY service_role_insert_events ON public.events
      FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- Transactions policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_view_their_transactions' AND n.nspname = 'public' AND c.relname = 'transactions'
  ) THEN
    CREATE POLICY users_view_their_transactions ON public.transactions
      FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
  END IF;
END
$$;

-- User rewards policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'users_view_their_rewards' AND n.nspname = 'public' AND c.relname = 'user_rewards'
  ) THEN
    CREATE POLICY users_view_their_rewards ON public.user_rewards
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

-- Ad creatives policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anyone_view_active_creatives' AND n.nspname = 'public' AND c.relname = 'ad_creatives'
  ) THEN
    CREATE POLICY anyone_view_active_creatives ON public.ad_creatives
      FOR SELECT USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'advertisers_manage_their_creatives' AND n.nspname = 'public' AND c.relname = 'ad_creatives'
  ) THEN
    CREATE POLICY advertisers_manage_their_creatives ON public.ad_creatives
      FOR ALL USING (
        campaign_id IN (SELECT id FROM public.campaigns WHERE advertiser_id = auth.uid())
      );
  END IF;
END
$$;

-- Platform settings policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'admins_manage_settings' AND n.nspname = 'public' AND c.relname = 'platform_settings'
  ) THEN
    CREATE POLICY admins_manage_settings ON public.platform_settings
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'anyone_view_settings' AND n.nspname = 'public' AND c.relname = 'platform_settings'
  ) THEN
    CREATE POLICY anyone_view_settings ON public.platform_settings
      FOR SELECT USING (true);
  END IF;
END
$$;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, did, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'did:metaverse:' || NEW.id::text,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers (drop first to be idempotent)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_publishers_updated_at ON public.publishers;
CREATE TRIGGER update_publishers_updated_at BEFORE UPDATE ON public.publishers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_advertisers_updated_at ON public.advertisers;
CREATE TRIGGER update_advertisers_updated_at BEFORE UPDATE ON public.advertisers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update campaign metrics
CREATE OR REPLACE FUNCTION public.update_campaign_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'impression' THEN
    UPDATE public.campaigns SET impressions = impressions + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.type = 'click' THEN
    UPDATE public.campaigns SET clicks = clicks + 1 WHERE id = NEW.campaign_id;
  ELSIF NEW.type = 'conversion' THEN
    UPDATE public.campaigns SET conversions = conversions + 1 WHERE id = NEW.campaign_id;
  END IF;
  
  -- Update CTR
  UPDATE public.campaigns 
  SET ctr = CASE WHEN impressions > 0 THEN (clicks::decimal / impressions::decimal) ELSE 0 END
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_campaign_metrics_trigger ON public.events;
CREATE TRIGGER update_campaign_metrics_trigger
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_campaign_metrics();

-- Function to update publisher metrics
CREATE OR REPLACE FUNCTION public.update_publisher_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'impression' THEN
    UPDATE public.publishers SET total_impressions = total_impressions + 1 WHERE id = NEW.publisher_id;
  ELSIF NEW.type = 'click' THEN
    UPDATE public.publishers SET total_clicks = total_clicks + 1 WHERE id = NEW.publisher_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_publisher_metrics_trigger ON public.events;
CREATE TRIGGER update_publisher_metrics_trigger
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_publisher_metrics();

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('platform_fee_percentage', '{"value": 10}', 'Platform fee percentage on transactions'),
  ('min_campaign_budget', '{"value": 100}', 'Minimum campaign budget in USD'),
  ('max_daily_impressions', '{"value": 1000000}', 'Maximum daily impressions per campaign'),
  ('reward_rates', '{"impression": 0.001, "click": 0.05, "conversion": 2.00}', 'Default reward rates')
ON CONFLICT (key) DO NOTHING;