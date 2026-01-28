-- Metaverse Advertising Platform Database Schema
-- PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  did VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  interests TEXT[],
  reward_preferences JSONB DEFAULT '{}',
  consents JSONB DEFAULT '{}',
  pds_url VARCHAR(500),
  wallet_address VARCHAR(42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(255) PRIMARY KEY,
  advertiser_did VARCHAR(255) REFERENCES users(did) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  audience_spec JSONB DEFAULT '{}',
  budget DECIMAL(18,6) DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'DEV-ERC20',
  creative_manifest JSONB DEFAULT '{}',
  payout_rules JSONB DEFAULT '{}',
  delivery_constraints JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft',
  metrics JSONB DEFAULT '{"impressions":0,"clicks":0,"conversions":0,"spent":0}',
  blockchain_tx_hash VARCHAR(66),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Publishers table
CREATE TABLE IF NOT EXISTS publishers (
  did VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  description TEXT,
  categories TEXT[],
  ad_slots JSONB DEFAULT '[]',
  payout_preferences JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{"totalImpressions":0,"totalClicks":0,"totalEarnings":0}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consents table
CREATE TABLE IF NOT EXISTS consents (
  id VARCHAR(255) PRIMARY KEY,
  user_did VARCHAR(255) REFERENCES users(did) ON DELETE CASCADE,
  scope VARCHAR(100) NOT NULL,
  campaign_id VARCHAR(255),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  signature VARCHAR(132),
  ipfs_hash VARCHAR(100),
  blockchain_tx_hash VARCHAR(66),
  is_active BOOLEAN DEFAULT true
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  ad_id VARCHAR(255),
  campaign_id VARCHAR(255) REFERENCES campaigns(id) ON DELETE SET NULL,
  user_did VARCHAR(255),
  publisher_did VARCHAR(255),
  slot_id VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  signature VARCHAR(132),
  ipfs_hash VARCHAR(100),
  blockchain_tx_hash VARCHAR(66)
);

-- Advertisers table
CREATE TABLE IF NOT EXISTS advertisers (
  did VARCHAR(255) PRIMARY KEY REFERENCES users(did) ON DELETE CASCADE,
  company_name VARCHAR(255),
  industry VARCHAR(100),
  verification_status VARCHAR(20) DEFAULT 'pending',
  billing_info JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table for payment tracking
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  amount DECIMAL(18,6),
  currency VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  blockchain_tx_hash VARCHAR(66),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_did);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_did);
CREATE INDEX IF NOT EXISTS idx_events_publisher ON events(publisher_did);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_did);
CREATE INDEX IF NOT EXISTS idx_consents_active ON consents(is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_address);

-- Insert demo users
INSERT INTO users (did, email, password_hash, display_name, interests) VALUES
  ('did:user:demo1', 'user@demo.com', '$2a$10$demo.hash.user', 'Demo User', ARRAY['technology', 'gaming', 'finance']),
  ('did:advertiser:demo1', 'advertiser@demo.com', '$2a$10$demo.hash.advertiser', 'Demo Advertiser', ARRAY['marketing', 'business']),
  ('did:publisher:demo1', 'publisher@demo.com', '$2a$10$demo.hash.publisher', 'Demo Publisher', ARRAY['content', 'media']),
  ('did:admin:demo1', 'admin@demo.com', '$2a$10$demo.hash.admin', 'Platform Admin', ARRAY['administration'])
ON CONFLICT (did) DO NOTHING;

-- Insert demo publisher
INSERT INTO publishers (did, name, domain, description, categories) VALUES
  ('did:publisher:demo1', 'Demo News Network', 'demo-news.com', 'Leading technology news platform', ARRAY['technology', 'news', 'gaming'])
ON CONFLICT (did) DO NOTHING;

-- Insert demo advertiser
INSERT INTO advertisers (did, company_name, industry, verification_status) VALUES
  ('did:advertiser:demo1', 'Demo Tech Corp', 'Technology', 'verified')
ON CONFLICT (did) DO NOTHING;

-- Insert demo campaign
INSERT INTO campaigns (
  id, advertiser_did, name, description, audience_spec, budget, status,
  creative_manifest, payout_rules
) VALUES (
  'campaign_demo_1',
  'did:advertiser:demo1',
  'Summer Tech Sale 2024',
  'Promote our latest tech products with exclusive summer discounts',
  '{"interests": ["technology", "gaming"], "ageRange": [18, 45], "locations": ["US", "CA", "UK"]}',
  5000.00,
  'active',
  '{"type": "banner", "imageUrl": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80", "ctaText": "Shop Now", "ctaUrl": "https://demo-tech.com/sale"}',
  '{"impressionPayout": 0.001, "clickPayout": 0.05, "conversionPayout": 2.00}'
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metaverse_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metaverse_user;