// Analytics Dashboard Service
// Provides real-time metrics, campaign performance, and transparency reporting

import DatabaseService from './database';
import { eventTracker } from './event-tracker';
import TransactionManager from './transaction-manager';
import FraudPreventionService from './fraud-prevention';

export interface DashboardMetrics {
  overview: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalPublishers: number;
    totalUsers: number;
    totalRevenue: number;
    totalPayouts: number;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cvr: number;
    averageCpm: number;
    averageCpc: number;
    averageCpa: number;
  };
  realtime: {
    activeUsers: number;
    eventsPerMinute: number;
    topCampaigns: CampaignPerformance[];
    topPublishers: PublisherPerformance[];
  };
  fraud: {
    totalAlerts: number;
    activeAlerts: number;
    blockedEntities: number;
    riskySessions: number;
  };
  blockchain: {
    totalTransactions: number;
    pendingTransactions: number;
    confirmedTransactions: number;
    failedTransactions: number;
  };
}

export interface CampaignPerformance {
  campaignId: string;
  name: string;
  advertiser: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spent: number;
  budget: number;
  ctr: number;
  cvr: number;
  roi: number;
  status: string;
  createdAt: string;
}

export interface PublisherPerformance {
  publisherDid: string;
  name: string;
  impressions: number;
  clicks: number;
  conversions: number;
  earnings: number;
  ctr: number;
  rpm: number;
  fillRate: number;
  status: string;
}

export interface UserEngagement {
  userDid: string;
  totalInteractions: number;
  totalEarnings: number;
  campaignsParticipated: number;
  averageSessionDuration: number;
  lastActivity: string;
  consentStatus: string;
}

export interface ConsentAnalytics {
  totalConsents: number;
  activeConsents: number;
  revokedConsents: number;
  consentsByScope: Record<string, number>;
  consentsByMonth: { month: string; count: number }[];
  adoptionRate: number;
}

export interface PayoutAnalytics {
  totalPayouts: number;
  payoutsByRole: {
    users: number;
    publishers: number;
    protocol: number;
  };
  payoutsByMonth: { month: string; amount: number }[];
  averagePayoutPerUser: number;
  averagePayoutPerPublisher: number;
}

export class AnalyticsDashboardService {
  private db: DatabaseService;
  private transactionManager: TransactionManager;
  private fraudService: FraudPreventionService;
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    db: DatabaseService,
    transactionManager: TransactionManager,
    fraudService: FraudPreventionService
  ) {
    this.db = db;
    this.transactionManager = transactionManager;
    this.fraudService = fraudService;
  }

  // ==================== MAIN DASHBOARD METRICS ====================

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard_metrics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const [overview, performance, realtime, fraud, blockchain] = await Promise.all([
      this.getOverviewMetrics(),
      this.getPerformanceMetrics(),
      this.getRealtimeMetrics(),
      this.fraudService.getFraudStats(),
      this.transactionManager.getTransactionStats()
    ]);

    const metrics: DashboardMetrics = {
      overview,
      performance,
      realtime,
      fraud,
      blockchain
    };

    this.setCachedData(cacheKey, metrics);
    return metrics;
  }

  private async getOverviewMetrics(): Promise<DashboardMetrics['overview']> {
    const client = await this.db['pool'].connect();
    
    try {
      const [campaignsResult, publishersResult, usersResult, revenueResult, payoutsResult] = await Promise.all([
        client.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = \'active\') as active FROM campaigns'),
        client.query('SELECT COUNT(*) as count FROM publishers WHERE status = \'active\''),
        client.query('SELECT COUNT(*) as count FROM users'),
        client.query('SELECT SUM((metrics->>\'spent\')::decimal) as total FROM campaigns'),
        client.query('SELECT SUM(amount) as total FROM payouts WHERE status = \'confirmed\'')
      ]);

      return {
        totalCampaigns: parseInt(campaignsResult.rows[0].total) || 0,
        activeCampaigns: parseInt(campaignsResult.rows[0].active) || 0,
        totalPublishers: parseInt(publishersResult.rows[0].count) || 0,
        totalUsers: parseInt(usersResult.rows[0].count) || 0,
        totalRevenue: parseFloat(revenueResult.rows[0].total) || 0,
        totalPayouts: parseFloat(payoutsResult.rows[0].total) || 0
      };
    } finally {
      client.release();
    }
  }

  private async getPerformanceMetrics(): Promise<DashboardMetrics['performance']> {
    const globalMetrics = await eventTracker.getGlobalMetrics();
    
    return {
      impressions: globalMetrics.impressions,
      clicks: globalMetrics.clicks,
      conversions: globalMetrics.conversions,
      ctr: globalMetrics.ctr,
      cvr: globalMetrics.cvr,
      averageCpm: globalMetrics.impressions > 0 ? (globalMetrics.revenue / globalMetrics.impressions) * 1000 : 0,
      averageCpc: globalMetrics.clicks > 0 ? globalMetrics.revenue / globalMetrics.clicks : 0,
      averageCpa: globalMetrics.conversions > 0 ? globalMetrics.revenue / globalMetrics.conversions : 0
    };
  }

  private async getRealtimeMetrics(): Promise<DashboardMetrics['realtime']> {
    const [topCampaigns, topPublishers] = await Promise.all([
      this.getTopCampaigns(5),
      this.getTopPublishers(5)
    ]);

    // Get active users (sessions in last hour)
    const client = await this.db['pool'].connect();
    let activeUsers = 0;
    let eventsPerMinute = 0;

    try {
      const activeUsersResult = await client.query(`
        SELECT COUNT(DISTINCT session_id) as count 
        FROM session_analytics 
        WHERE last_activity > NOW() - INTERVAL '1 hour'
      `);
      activeUsers = parseInt(activeUsersResult.rows[0].count) || 0;

      const eventsResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE timestamp > NOW() - INTERVAL '1 minute'
      `);
      eventsPerMinute = parseInt(eventsResult.rows[0].count) || 0;
    } finally {
      client.release();
    }

    return {
      activeUsers,
      eventsPerMinute,
      topCampaigns,
      topPublishers
    };
  }

  // ==================== CAMPAIGN ANALYTICS ====================

  async getCampaignPerformance(campaignId?: string, limit: number = 20): Promise<CampaignPerformance[]> {
    const cacheKey = `campaign_performance_${campaignId || 'all'}_${limit}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const client = await this.db['pool'].connect();
    
    try {
      let query = `
        SELECT 
          c.id as campaign_id,
          c.name,
          c.advertiser_did as advertiser,
          c.budget,
          c.status,
          c.created_at,
          (c.metrics->>'impressions')::int as impressions,
          (c.metrics->>'clicks')::int as clicks,
          (c.metrics->>'conversions')::int as conversions,
          (c.metrics->>'spent')::decimal as spent
        FROM campaigns c
      `;
      
      const params = [];
      if (campaignId) {
        query += ' WHERE c.id = $1';
        params.push(campaignId);
      }
      
      query += ' ORDER BY c.created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await client.query(query, params);
      
      const campaigns: CampaignPerformance[] = result.rows.map(row => {
        const impressions = row.impressions || 0;
        const clicks = row.clicks || 0;
        const conversions = row.conversions || 0;
        const spent = parseFloat(row.spent) || 0;
        const budget = parseFloat(row.budget) || 0;

        return {
          campaignId: row.campaign_id,
          name: row.name,
          advertiser: row.advertiser,
          impressions,
          clicks,
          conversions,
          spent,
          budget,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
          roi: spent > 0 ? ((conversions * 10 - spent) / spent) * 100 : 0, // Assuming $10 per conversion
          status: row.status,
          createdAt: row.created_at?.toISOString()
        };
      });

      this.setCachedData(cacheKey, campaigns);
      return campaigns;
    } finally {
      client.release();
    }
  }

  async getTopCampaigns(limit: number = 10): Promise<CampaignPerformance[]> {
    const campaigns = await this.getCampaignPerformance(undefined, 50);
    
    // Sort by performance score (combination of CTR, CVR, and spend efficiency)
    return campaigns
      .map(campaign => ({
        ...campaign,
        performanceScore: (campaign.ctr * 0.3) + (campaign.cvr * 0.4) + (campaign.roi * 0.3)
      }))
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit);
  }

  async getCampaignTrends(campaignId: string, days: number = 30): Promise<{
    daily: { date: string; impressions: number; clicks: number; conversions: number; spent: number }[];
    hourly: { hour: number; impressions: number; clicks: number; conversions: number }[];
  }> {
    const client = await this.db['pool'].connect();
    
    try {
      // Daily trends
      const dailyResult = await client.query(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) FILTER (WHERE type = 'impression') as impressions,
          COUNT(*) FILTER (WHERE type = 'click') as clicks,
          COUNT(*) FILTER (WHERE type = 'conversion') as conversions
        FROM events 
        WHERE campaign_id = $1 
        AND timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `, [campaignId]);

      // Hourly trends (last 24 hours)
      const hourlyResult = await client.query(`
        SELECT 
          EXTRACT(HOUR FROM timestamp) as hour,
          COUNT(*) FILTER (WHERE type = 'impression') as impressions,
          COUNT(*) FILTER (WHERE type = 'click') as clicks,
          COUNT(*) FILTER (WHERE type = 'conversion') as conversions
        FROM events 
        WHERE campaign_id = $1 
        AND timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(HOUR FROM timestamp)
        ORDER BY hour
      `, [campaignId]);

      return {
        daily: dailyResult.rows.map(row => ({
          date: row.date,
          impressions: parseInt(row.impressions) || 0,
          clicks: parseInt(row.clicks) || 0,
          conversions: parseInt(row.conversions) || 0,
          spent: 0 // Would need to calculate from payout data
        })),
        hourly: hourlyResult.rows.map(row => ({
          hour: parseInt(row.hour),
          impressions: parseInt(row.impressions) || 0,
          clicks: parseInt(row.clicks) || 0,
          conversions: parseInt(row.conversions) || 0
        }))
      };
    } finally {
      client.release();
    }
  }

  // ==================== PUBLISHER ANALYTICS ====================

  async getPublisherPerformance(publisherDid?: string, limit: number = 20): Promise<PublisherPerformance[]> {
    const cacheKey = `publisher_performance_${publisherDid || 'all'}_${limit}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const client = await this.db['pool'].connect();
    
    try {
      let query = `
        SELECT 
          p.did as publisher_did,
          p.name,
          p.status,
          (p.metrics->>'totalImpressions')::int as impressions,
          (p.metrics->>'totalClicks')::int as clicks,
          (p.metrics->>'totalEarnings')::decimal as earnings,
          COALESCE(event_stats.conversions, 0) as conversions
        FROM publishers p
        LEFT JOIN (
          SELECT 
            publisher_did,
            COUNT(*) FILTER (WHERE type = 'conversion') as conversions
          FROM events
          GROUP BY publisher_did
        ) event_stats ON p.did = event_stats.publisher_did
      `;
      
      const params = [];
      if (publisherDid) {
        query += ' WHERE p.did = $1';
        params.push(publisherDid);
      }
      
      query += ' ORDER BY (p.metrics->\'totalEarnings\')::decimal DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await client.query(query, params);
      
      const publishers: PublisherPerformance[] = result.rows.map(row => {
        const impressions = row.impressions || 0;
        const clicks = row.clicks || 0;
        const conversions = row.conversions || 0;
        const earnings = parseFloat(row.earnings) || 0;

        return {
          publisherDid: row.publisher_did,
          name: row.name,
          impressions,
          clicks,
          conversions,
          earnings,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          rpm: impressions > 0 ? (earnings / impressions) * 1000 : 0,
          fillRate: 85 + Math.random() * 15, // Mock fill rate for demo
          status: row.status
        };
      });

      this.setCachedData(cacheKey, publishers);
      return publishers;
    } finally {
      client.release();
    }
  }

  async getTopPublishers(limit: number = 10): Promise<PublisherPerformance[]> {
    const publishers = await this.getPublisherPerformance(undefined, 50);
    
    // Sort by earnings
    return publishers
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
  }

  // ==================== USER ENGAGEMENT ANALYTICS ====================

  async getUserEngagement(userDid?: string, limit: number = 20): Promise<UserEngagement[]> {
    const client = await this.db['pool'].connect();
    
    try {
      let query = `
        SELECT 
          u.did as user_did,
          u.display_name,
          COALESCE(event_stats.total_interactions, 0) as total_interactions,
          COALESCE(payout_stats.total_earnings, 0) as total_earnings,
          COALESCE(event_stats.campaigns_participated, 0) as campaigns_participated,
          COALESCE(session_stats.avg_session_duration, 0) as average_session_duration,
          COALESCE(event_stats.last_activity, u.created_at) as last_activity,
          CASE 
            WHEN consent_stats.active_consents > 0 THEN 'active'
            ELSE 'inactive'
          END as consent_status
        FROM users u
        LEFT JOIN (
          SELECT 
            user_did,
            COUNT(*) as total_interactions,
            COUNT(DISTINCT campaign_id) as campaigns_participated,
            MAX(timestamp) as last_activity
          FROM events
          GROUP BY user_did
        ) event_stats ON u.did = event_stats.user_did
        LEFT JOIN (
          SELECT 
            recipient_did,
            SUM(amount) as total_earnings
          FROM payouts
          WHERE status = 'confirmed' AND role = 'user'
          GROUP BY recipient_did
        ) payout_stats ON u.did = payout_stats.recipient_did
        LEFT JOIN (
          SELECT 
            user_did,
            AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) as avg_session_duration
          FROM session_analytics
          GROUP BY user_did
        ) session_stats ON u.did = session_stats.user_did
        LEFT JOIN (
          SELECT 
            user_did,
            COUNT(*) FILTER (WHERE is_active = true) as active_consents
          FROM consents
          GROUP BY user_did
        ) consent_stats ON u.did = consent_stats.user_did
      `;
      
      const params = [];
      if (userDid) {
        query += ' WHERE u.did = $1';
        params.push(userDid);
      }
      
      query += ' ORDER BY total_interactions DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        userDid: row.user_did,
        totalInteractions: parseInt(row.total_interactions) || 0,
        totalEarnings: parseFloat(row.total_earnings) || 0,
        campaignsParticipated: parseInt(row.campaigns_participated) || 0,
        averageSessionDuration: parseFloat(row.average_session_duration) || 0,
        lastActivity: row.last_activity?.toISOString(),
        consentStatus: row.consent_status
      }));
    } finally {
      client.release();
    }
  }

  // ==================== CONSENT ANALYTICS ====================

  async getConsentAnalytics(): Promise<ConsentAnalytics> {
    const cacheKey = 'consent_analytics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const client = await this.db['pool'].connect();
    
    try {
      const [totalResult, scopeResult, monthlyResult, usersResult] = await Promise.all([
        client.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_active = true) as active,
            COUNT(*) FILTER (WHERE is_active = false) as revoked
          FROM consents
        `),
        client.query(`
          SELECT scope, COUNT(*) as count
          FROM consents
          WHERE is_active = true
          GROUP BY scope
        `),
        client.query(`
          SELECT 
            TO_CHAR(granted_at, 'YYYY-MM') as month,
            COUNT(*) as count
          FROM consents
          WHERE granted_at >= NOW() - INTERVAL '12 months'
          GROUP BY TO_CHAR(granted_at, 'YYYY-MM')
          ORDER BY month
        `),
        client.query('SELECT COUNT(*) as count FROM users')
      ]);

      const totalConsents = parseInt(totalResult.rows[0].total) || 0;
      const activeConsents = parseInt(totalResult.rows[0].active) || 0;
      const revokedConsents = parseInt(totalResult.rows[0].revoked) || 0;
      const totalUsers = parseInt(usersResult.rows[0].count) || 0;

      const consentsByScope = scopeResult.rows.reduce((acc, row) => {
        acc[row.scope] = parseInt(row.count);
        return acc;
      }, {});

      const consentsByMonth = monthlyResult.rows.map(row => ({
        month: row.month,
        count: parseInt(row.count)
      }));

      const analytics: ConsentAnalytics = {
        totalConsents,
        activeConsents,
        revokedConsents,
        consentsByScope,
        consentsByMonth,
        adoptionRate: totalUsers > 0 ? (activeConsents / totalUsers) * 100 : 0
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;
    } finally {
      client.release();
    }
  }

  // ==================== PAYOUT ANALYTICS ====================

  async getPayoutAnalytics(): Promise<PayoutAnalytics> {
    const cacheKey = 'payout_analytics';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const client = await this.db['pool'].connect();
    
    try {
      const [totalResult, roleResult, monthlyResult, avgResult] = await Promise.all([
        client.query('SELECT COUNT(*) as count, SUM(amount) as total FROM payouts WHERE status = \'confirmed\''),
        client.query(`
          SELECT 
            role,
            SUM(amount) as total
          FROM payouts
          WHERE status = 'confirmed'
          GROUP BY role
        `),
        client.query(`
          SELECT 
            TO_CHAR(processed_at, 'YYYY-MM') as month,
            SUM(amount) as amount
          FROM payouts
          WHERE status = 'confirmed' AND processed_at >= NOW() - INTERVAL '12 months'
          GROUP BY TO_CHAR(processed_at, 'YYYY-MM')
          ORDER BY month
        `),
        client.query(`
          SELECT 
            role,
            AVG(amount) as avg_amount
          FROM payouts
          WHERE status = 'confirmed'
          GROUP BY role
        `)
      ]);

      const totalPayouts = parseFloat(totalResult.rows[0].total) || 0;

      const payoutsByRole = roleResult.rows.reduce((acc, row) => {
        acc[row.role + 's'] = parseFloat(row.total); // users, publishers, protocol
        return acc;
      }, { users: 0, publishers: 0, protocol: 0 });

      const payoutsByMonth = monthlyResult.rows.map(row => ({
        month: row.month,
        amount: parseFloat(row.amount)
      }));

      const avgPayouts = avgResult.rows.reduce((acc, row) => {
        if (row.role === 'user') acc.averagePayoutPerUser = parseFloat(row.avg_amount);
        if (row.role === 'publisher') acc.averagePayoutPerPublisher = parseFloat(row.avg_amount);
        return acc;
      }, { averagePayoutPerUser: 0, averagePayoutPerPublisher: 0 });

      const analytics: PayoutAnalytics = {
        totalPayouts,
        payoutsByRole,
        payoutsByMonth,
        ...avgPayouts
      };

      this.setCachedData(cacheKey, analytics);
      return analytics;
    } finally {
      client.release();
    }
  }

  // ==================== REAL-TIME EVENTS ====================

  async getRealtimeEvents(eventType?: string, limit: number = 100): Promise<any[]> {
    if (eventType) {
      return await eventTracker.getRealtimeEvents(eventType as any, limit);
    }

    // Get mixed events from all types
    const [impressions, clicks, conversions] = await Promise.all([
      eventTracker.getRealtimeEvents('impression', limit / 3),
      eventTracker.getRealtimeEvents('click', limit / 3),
      eventTracker.getRealtimeEvents('conversion', limit / 3)
    ]);

    return [...impressions, ...clicks, ...conversions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ==================== EXPORT FUNCTIONS ====================

  async exportCampaignData(campaignId: string): Promise<{
    campaign: any;
    events: any[];
    payouts: any[];
    performance: CampaignPerformance;
  }> {
    const [campaign, events, payouts, performance] = await Promise.all([
      this.db.getCampaign(campaignId),
      this.db.getEventsByCampaign(campaignId),
      this.transactionManager.getCampaignPayouts(campaignId),
      this.getCampaignPerformance(campaignId, 1)
    ]);

    return {
      campaign,
      events,
      payouts,
      performance: performance[0]
    };
  }

  // ==================== CACHE MANAGEMENT ====================

  private getCachedData(key: string): any {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.metricsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.metricsCache.clear();
  }
}

export default AnalyticsDashboardService;