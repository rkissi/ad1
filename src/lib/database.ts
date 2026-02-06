// PostgreSQL Database Layer for Metaverse Advertising Platform
import { Pool, PoolClient } from 'pg';
import { UserProfile, Campaign, ConsentReceipt, EventReceipt, Publisher, Advertiser } from '@/types/platform';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  /**
   * @deprecated This service is being replaced by Supabase Native integration.
   * Please use src/lib/supabase-database.ts and Supabase Client instead.
   */
  constructor(config?: DatabaseConfig) {
    console.warn('⚠️ DEPRECATED: DatabaseService is using legacy PostgreSQL connection. Please migrate to Supabase Native.');

    // Use environment variables or fallback to local development
    const dbConfig = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'metaverse_ads',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production'
    };

    this.pool = new Pool(dbConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.pool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
      this.isConnected = true;
    });

    this.pool.on('error', (err) => {
      console.error('❌ PostgreSQL connection error:', err);
      this.isConnected = false;
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.createTables();
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Users table
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
        )
      `);

      // Campaigns table
      await client.query(`
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
        )
      `);

      // Publishers table
      await client.query(`
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
        )
      `);

      // Consents table
      await client.query(`
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
        )
      `);

      // Events table
      await client.query(`
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
        )
      `);

      // Advertisers table
      await client.query(`
        CREATE TABLE IF NOT EXISTS advertisers (
          did VARCHAR(255) PRIMARY KEY REFERENCES users(did),
          company_name VARCHAR(255),
          industry VARCHAR(100),
          verification_status VARCHAR(20) DEFAULT 'pending',
          billing_info JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_did)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(campaign_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_did)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_did)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_consents_active ON consents(is_active)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== USER OPERATIONS ====================

  async createUser(user: UserProfile & { passwordHash: string }): Promise<UserProfile> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO users (did, email, password_hash, display_name, interests, reward_preferences, consents, pds_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        user.did,
        user.email,
        user.passwordHash,
        user.displayName,
        user.interests,
        JSON.stringify(user.rewardPreferences),
        JSON.stringify(user.consents),
        user.pdsUrl
      ];

      const result = await client.query(query, values);
      return this.mapUserFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getUserByDid(did: string): Promise<UserProfile | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM users WHERE did = $1', [did]);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email: string): Promise<(UserProfile & { passwordHash: string }) | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
      if (!result.rows[0]) return null;
      
      const user = this.mapUserFromDb(result.rows[0]);
      return { ...user, passwordHash: result.rows[0].password_hash };
    } finally {
      client.release();
    }
  }

  async updateUser(did: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const client = await this.pool.connect();
    
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (updates.displayName !== undefined) {
        setClause.push(`display_name = $${paramCount++}`);
        values.push(updates.displayName);
      }
      if (updates.interests !== undefined) {
        setClause.push(`interests = $${paramCount++}`);
        values.push(updates.interests);
      }
      if (updates.rewardPreferences !== undefined) {
        setClause.push(`reward_preferences = $${paramCount++}`);
        values.push(JSON.stringify(updates.rewardPreferences));
      }
      if (updates.consents !== undefined) {
        setClause.push(`consents = $${paramCount++}`);
        values.push(JSON.stringify(updates.consents));
      }

      if (setClause.length === 0) return null;

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(did);

      const query = `
        UPDATE users 
        SET ${setClause.join(', ')}
        WHERE did = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0] ? this.mapUserFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // ==================== CAMPAIGN OPERATIONS ====================

  async createCampaign(campaign: Campaign): Promise<Campaign> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO campaigns (
          id, advertiser_did, name, description, audience_spec, budget, currency,
          creative_manifest, payout_rules, delivery_constraints, status, metrics
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const values = [
        campaign.id,
        campaign.advertiser,
        campaign.name,
        campaign.description,
        JSON.stringify(campaign.audienceSpec),
        campaign.budget,
        campaign.currency,
        JSON.stringify(campaign.creativeManifest),
        JSON.stringify(campaign.payoutRules),
        JSON.stringify(campaign.deliveryConstraints),
        campaign.status,
        JSON.stringify(campaign.metrics)
      ];

      const result = await client.query(query, values);
      return this.mapCampaignFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM campaigns WHERE id = $1', [id]);
      return result.rows[0] ? this.mapCampaignFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getCampaignsByAdvertiser(advertiserDid: string): Promise<Campaign[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM campaigns WHERE advertiser_did = $1 ORDER BY created_at DESC',
        [advertiserDid]
      );
      return result.rows.map(row => this.mapCampaignFromDb(row));
    } finally {
      client.release();
    }
  }

  async getActiveCampaigns(): Promise<Campaign[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM campaigns WHERE status = $1 ORDER BY created_at DESC',
        ['active']
      );
      return result.rows.map(row => this.mapCampaignFromDb(row));
    } finally {
      client.release();
    }
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    const client = await this.pool.connect();
    
    try {
      const setClause = [];
      const values = [];
      let paramCount = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const dbKey = this.camelToSnake(key);
          if (['audience_spec', 'creative_manifest', 'payout_rules', 'delivery_constraints', 'metrics'].includes(dbKey)) {
            setClause.push(`${dbKey} = $${paramCount++}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${dbKey} = $${paramCount++}`);
            values.push(value);
          }
        }
      });

      if (setClause.length === 0) return null;

      setClause.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE campaigns 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0] ? this.mapCampaignFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // ==================== EVENT OPERATIONS ====================

  async createEvent(event: EventReceipt): Promise<EventReceipt> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO events (
          id, type, ad_id, campaign_id, user_did, publisher_did, slot_id,
          timestamp, metadata, signature, ipfs_hash, blockchain_tx_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const values = [
        event.id,
        event.type,
        event.adId,
        event.campaignId,
        event.userDid,
        event.publisherDid,
        event.slotId,
        event.timestamp,
        JSON.stringify(event.metadata),
        event.signature,
        event.ipfsHash,
        event.blockchainTxHash
      ];

      const result = await client.query(query, values);
      return this.mapEventFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getEventsByCampaign(campaignId: string): Promise<EventReceipt[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM events WHERE campaign_id = $1 ORDER BY timestamp DESC',
        [campaignId]
      );
      return result.rows.map(row => this.mapEventFromDb(row));
    } finally {
      client.release();
    }
  }

  async getEventsByUser(userDid: string): Promise<EventReceipt[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM events WHERE user_did = $1 ORDER BY timestamp DESC',
        [userDid]
      );
      return result.rows.map(row => this.mapEventFromDb(row));
    } finally {
      client.release();
    }
  }

  // ==================== CONSENT OPERATIONS ====================

  async createConsent(consent: ConsentReceipt): Promise<ConsentReceipt> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO consents (
          id, user_did, scope, campaign_id, granted_at, signature, ipfs_hash, blockchain_tx_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const values = [
        consent.id,
        consent.userDid,
        consent.scope,
        consent.campaignId,
        consent.grantedAt,
        consent.signature,
        consent.ipfsHash,
        consent.blockchainTxHash
      ];

      const result = await client.query(query, values);
      return this.mapConsentFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getConsentsByUser(userDid: string): Promise<ConsentReceipt[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM consents WHERE user_did = $1 AND is_active = true ORDER BY granted_at DESC',
        [userDid]
      );
      return result.rows.map(row => this.mapConsentFromDb(row));
    } finally {
      client.release();
    }
  }

  // ==================== PUBLISHER OPERATIONS ====================

  async createPublisher(publisher: Publisher): Promise<Publisher> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO publishers (
          did, name, domain, description, categories, ad_slots, payout_preferences, metrics, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        publisher.did,
        publisher.name,
        publisher.domain,
        publisher.description,
        publisher.categories,
        JSON.stringify(publisher.adSlots),
        JSON.stringify(publisher.payoutPreferences),
        JSON.stringify(publisher.metrics),
        publisher.status
      ];

      const result = await client.query(query, values);
      return this.mapPublisherFromDb(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getPublisher(did: string): Promise<Publisher | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT * FROM publishers WHERE did = $1', [did]);
      return result.rows[0] ? this.mapPublisherFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  // ==================== UTILITY METHODS ====================

  private mapUserFromDb(row: any): UserProfile {
    return {
      did: row.did,
      email: row.email,
      displayName: row.display_name,
      interests: row.interests || [],
      rewardPreferences: row.reward_preferences,
      consents: row.consents,
      pdsUrl: row.pds_url,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    };
  }

  private mapCampaignFromDb(row: any): Campaign {
    return {
      id: row.id,
      advertiser: row.advertiser_did,
      name: row.name,
      description: row.description,
      audienceSpec: row.audience_spec,
      budget: parseFloat(row.budget),
      currency: row.currency,
      creativeManifest: row.creative_manifest,
      payoutRules: row.payout_rules,
      deliveryConstraints: row.delivery_constraints,
      status: row.status,
      metrics: row.metrics,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    };
  }

  private mapEventFromDb(row: any): EventReceipt {
    return {
      id: row.id,
      type: row.type,
      adId: row.ad_id,
      campaignId: row.campaign_id,
      userDid: row.user_did,
      publisherDid: row.publisher_did,
      slotId: row.slot_id,
      timestamp: row.timestamp?.toISOString(),
      metadata: row.metadata || {},
      signature: row.signature,
      ipfsHash: row.ipfs_hash,
      blockchainTxHash: row.blockchain_tx_hash
    };
  }

  private mapConsentFromDb(row: any): ConsentReceipt {
    return {
      id: row.id,
      userDid: row.user_did,
      scope: row.scope,
      campaignId: row.campaign_id,
      grantedAt: row.granted_at?.toISOString(),
      signature: row.signature,
      ipfsHash: row.ipfs_hash,
      blockchainTxHash: row.blockchain_tx_hash
    };
  }

  private mapPublisherFromDb(row: any): Publisher {
    return {
      did: row.did,
      name: row.name,
      domain: row.domain,
      description: row.description,
      categories: row.categories || [],
      adSlots: row.ad_slots || [],
      payoutPreferences: row.payout_preferences,
      metrics: row.metrics,
      status: row.status,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString()
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export default DatabaseService;