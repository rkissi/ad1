#!/usr/bin/env node

/**
 * Database Setup Script
 * Initializes PostgreSQL database with required tables and seed data
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'metaverse_ads',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database setup...');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        did VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        interests TEXT[],
        reward_preferences JSONB,
        consents JSONB,
        pds_url VARCHAR(500),
        wallet_address VARCHAR(42),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id VARCHAR(255) PRIMARY KEY,
        advertiser_did VARCHAR(255) REFERENCES users(did),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        audience_spec JSONB,
        budget DECIMAL(18,6),
        currency VARCHAR(20) DEFAULT 'DEV-ERC20',
        creative_manifest JSONB,
        payout_rules JSONB,
        delivery_constraints JSONB,
        status VARCHAR(20) DEFAULT 'draft',
        metrics JSONB DEFAULT '{"impressions":0,"clicks":0,"conversions":0,"spent":0}',
        blockchain_tx_hash VARCHAR(66),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS publishers (
        did VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        description TEXT,
        categories TEXT[],
        ad_slots JSONB,
        payout_preferences JSONB,
        metrics JSONB DEFAULT '{"totalImpressions":0,"totalClicks":0,"totalEarnings":0}',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS consents (
        id VARCHAR(255) PRIMARY KEY,
        user_did VARCHAR(255) REFERENCES users(did),
        scope VARCHAR(100) NOT NULL,
        campaign_id VARCHAR(255),
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        signature VARCHAR(132),
        ipfs_hash VARCHAR(100),
        blockchain_tx_hash VARCHAR(66),
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        ad_id VARCHAR(255),
        campaign_id VARCHAR(255) REFERENCES campaigns(id),
        user_did VARCHAR(255),
        publisher_did VARCHAR(255),
        slot_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        signature VARCHAR(132),
        ipfs_hash VARCHAR(100),
        blockchain_tx_hash VARCHAR(66)
      );

      CREATE TABLE IF NOT EXISTS advertisers (
        did VARCHAR(255) PRIMARY KEY REFERENCES users(did),
        company_name VARCHAR(255),
        industry VARCHAR(100),
        verification_status VARCHAR(20) DEFAULT 'pending',
        billing_info JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_did);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_did);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_did);
      CREATE INDEX IF NOT EXISTS idx_consents_active ON consents(is_active);
    `);

    console.log('✅ Database tables created successfully');

    // Insert seed data
    await client.query(`
      INSERT INTO users (did, email, password_hash, display_name, interests)
      VALUES 
        ('did:user:demo1', 'demo@user.com', 'password123', 'Demo User', ARRAY['tech', 'gaming']),
        ('did:advertiser:demo1', 'demo@advertiser.com', 'password123', 'Demo Advertiser', ARRAY['marketing']),
        ('did:publisher:demo1', 'demo@publisher.com', 'password123', 'Demo Publisher', ARRAY['content'])
      ON CONFLICT (did) DO NOTHING;
    `);

    console.log('✅ Seed data inserted successfully');
    console.log('🎉 Database setup complete!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase().catch(console.error);