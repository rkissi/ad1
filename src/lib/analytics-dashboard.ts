// Analytics Dashboard Service
// Provides real-time metrics, campaign performance, and transparency reporting

import { eventTracker } from './event-tracker';
import TransactionManager from './transaction-manager';
import FraudPreventionService from './fraud-prevention';
import { supabaseServer } from './supabase-server';

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
  advertiser: string; // ID or name
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
  private transactionManager: TransactionManager;
  private fraudService: FraudPreventionService;
  private metricsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private supabase = supabaseServer;

  constructor(
    transactionManager: TransactionManager,
    fraudService: FraudPreventionService
  ) {
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
    const { data, error } = await this.supabase.rpc('get_overview_metrics');
    
    if (error) {
       console.error('Overview metrics error:', error);
       return {
         totalCampaigns: 0,
         activeCampaigns: 0,
         totalPublishers: 0,
         totalUsers: 0,
         totalRevenue: 0,
         totalPayouts: 0
       };
    }

    return data as DashboardMetrics['overview'];
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

    // Active users in last hour (via session_analytics)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: activeUsers } = await this.supabase
      .from('session_analytics')
      .select('session_id', { count: 'exact', head: true })
      .gt('last_activity', oneHourAgo);

    // Events in last minute (via events table)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: eventsPerMinute } = await this.supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gt('timestamp', oneMinuteAgo);

    return {
      activeUsers: activeUsers || 0,
      eventsPerMinute: eventsPerMinute || 0,
      topCampaigns,
      topPublishers
    };
  }

  // ==================== CAMPAIGN ANALYTICS ====================

  async getCampaignPerformance(campaignId?: string, limit: number = 20): Promise<CampaignPerformance[]> {
    let query = this.supabase.from('campaigns').select('*');
    if (campaignId) query = query.eq('id', campaignId);
    
    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(row => ({
        campaignId: row.id,
        name: row.name,
        advertiser: row.advertiser_id || 'unknown',
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        conversions: row.conversions || 0,
        spent: Number(row.spent || 0),
        budget: Number(row.budget || 0),
        ctr: Number(row.ctr || 0) * 100, // DB stores ratio 0-1, return percentage? Code earlier used (clicks/imp)*100
        cvr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
        roi: Number(row.spent) > 0 ? ((row.conversions * 10 - Number(row.spent)) / Number(row.spent)) * 100 : 0,
        status: row.status || 'draft',
        createdAt: row.created_at || ''
    }));
  }

  async getTopCampaigns(limit: number = 10): Promise<CampaignPerformance[]> {
    const campaigns = await this.getCampaignPerformance(undefined, 50);
    return campaigns
      .sort((a, b) => b.ctr - a.ctr) // Simple sort by CTR for now
      .slice(0, limit);
  }

  // ==================== PUBLISHER ANALYTICS ====================

  async getPublisherPerformance(publisherDid?: string, limit: number = 20): Promise<PublisherPerformance[]> {
    // Note: Schema uses 'publishers' table which has 'metrics' JSONB?
    // 01_schema.sql: publishers has total_impressions, total_clicks columns.
    // It also has total_earnings.
    // user_id connects to profile.
    
    let query = this.supabase.from('publishers').select('*');
    if (publisherDid) query = query.eq('id', publisherDid); // Using id as DID proxy for now, or did column if exists.
    // 01_schema.sql doesn't have 'did' column in publishers, it uses UUID id.
    // But profiles has 'did'.
    // Legacy code used 'did'.
    // I should check if 'publishers' has 'did'.
    // 01_schema.sql: `id UUID PRIMARY KEY`. No 'did' column.
    // So 'publisherDid' in args refers to UUID likely in new system.

    query = query.order('total_earnings', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map(row => ({
        publisherDid: row.id,
        name: row.name,
        impressions: row.total_impressions || 0,
        clicks: row.total_clicks || 0,
        conversions: 0, // Not stored in publishers table
        earnings: Number(row.total_earnings || 0),
        ctr: row.total_impressions > 0 ? (row.total_clicks / row.total_impressions) * 100 : 0,
        rpm: row.total_impressions > 0 ? (row.total_earnings / row.total_impressions) * 1000 : 0,
        fillRate: 0,
        status: row.status || 'active'
    }));
  }

  async getTopPublishers(limit: number = 10): Promise<PublisherPerformance[]> {
    const publishers = await this.getPublisherPerformance(undefined, 50);
    return publishers
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, limit);
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
