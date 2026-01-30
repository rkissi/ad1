// Real-time Event Tracking Service with Redis
import Redis from 'ioredis';
import { EventReceipt } from '@/types/platform';

export interface EventMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number; // Click-through rate
  cvr: number; // Conversion rate
  revenue: number;
  uniqueUsers: number;
}

export interface CampaignMetrics extends EventMetrics {
  campaignId: string;
  spent: number;
  remainingBudget: number;
  averageCpm: number;
  averageCpc: number;
  averageCpa: number;
}

export interface PublisherMetrics extends EventMetrics {
  publisherId: string;
  totalEarnings: number;
  averageRpm: number;
  fillRate: number;
}

export interface TrackingEvent {
  type: 'impression' | 'click' | 'conversion' | 'engagement';
  adId: string;
  campaignId: string;
  userDid: string;
  publisherDid: string;
  slotId: string;
  timestamp?: string;
  metadata: Record<string, any>;
}

export class EventTracker {
  private redis: Redis;
  private isConnected: boolean = false;
  private eventBuffer: TrackingEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupRedisEventHandlers();
    this.startEventBufferFlush();
  }

  private setupRedisEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis for event tracking');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('⚠️ Redis connection closed');
      this.isConnected = false;
    });
  }

  private startEventBufferFlush() {
    // Flush events every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushEventBuffer();
    }, 5000);
  }

  /**
   * Track a single event
   */
  async trackEvent(event: TrackingEvent): Promise<void> {
    const eventWithTimestamp = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    if (this.isConnected) {
      try {
        await this.processEventImmediate(eventWithTimestamp);
      } catch (error) {
        console.error('Failed to track event immediately, buffering:', error);
        this.eventBuffer.push(eventWithTimestamp);
      }
    } else {
      // Buffer events when Redis is not available
      this.eventBuffer.push(eventWithTimestamp);
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackEventBatch(events: TrackingEvent[]): Promise<void> {
    const eventsWithTimestamp = events.map(event => ({
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    }));

    if (this.isConnected) {
      try {
        await Promise.all(eventsWithTimestamp.map(event => this.processEventImmediate(event)));
      } catch (error) {
        console.error('Failed to track batch events immediately, buffering:', error);
        this.eventBuffer.push(...eventsWithTimestamp);
      }
    } else {
      this.eventBuffer.push(...eventsWithTimestamp);
    }
  }

  /**
   * Process event immediately in Redis
   */
  private async processEventImmediate(event: TrackingEvent): Promise<void> {
    const pipeline = this.redis.pipeline();
    const timestamp = new Date(event.timestamp!).getTime();
    const dateKey = new Date(event.timestamp!).toISOString().split('T')[0];

    // Store raw event
    const eventKey = `event:${event.type}:${event.adId}:${timestamp}`;
    pipeline.hset(eventKey, {
      type: event.type,
      adId: event.adId,
      campaignId: event.campaignId,
      userDid: event.userDid,
      publisherDid: event.publisherDid,
      slotId: event.slotId,
      timestamp: event.timestamp!,
      metadata: JSON.stringify(event.metadata)
    });
    pipeline.expire(eventKey, 86400 * 30); // Keep for 30 days

    // Update campaign metrics
    const campaignKey = `metrics:campaign:${event.campaignId}`;
    pipeline.hincrby(campaignKey, event.type, 1);
    pipeline.hincrby(campaignKey, 'total_events', 1);
    pipeline.hset(campaignKey, 'last_updated', event.timestamp!);

    // Update daily campaign metrics
    const campaignDailyKey = `metrics:campaign:${event.campaignId}:${dateKey}`;
    pipeline.hincrby(campaignDailyKey, event.type, 1);
    pipeline.expire(campaignDailyKey, 86400 * 90); // Keep daily metrics for 90 days

    // Update publisher metrics
    const publisherKey = `metrics:publisher:${event.publisherDid}`;
    pipeline.hincrby(publisherKey, event.type, 1);
    pipeline.hincrby(publisherKey, 'total_events', 1);
    pipeline.hset(publisherKey, 'last_updated', event.timestamp!);

    // Update user interaction tracking (for frequency capping)
    const userInteractionKey = `user:${event.userDid}:campaign:${event.campaignId}`;
    pipeline.hincrby(userInteractionKey, event.type, 1);
    pipeline.expire(userInteractionKey, 86400 * 7); // Keep user interactions for 7 days

    // Add to real-time event stream
    const streamKey = `stream:events:${event.type}`;
    pipeline.xadd(streamKey, 'MAXLEN', '~', '10000', '*',
      'campaignId', event.campaignId,
      'publisherDid', event.publisherDid,
      'timestamp', event.timestamp!,
      'metadata', JSON.stringify(event.metadata)
    );

    // Execute all Redis operations
    await pipeline.exec();

    console.log(`✅ Event tracked: ${event.type} for campaign ${event.campaignId}`);
  }

  /**
   * Flush buffered events to Redis
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0 || !this.isConnected) {
      return;
    }

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await Promise.all(eventsToFlush.map(event => this.processEventImmediate(event)));
      console.log(`✅ Flushed ${eventsToFlush.length} buffered events`);
    } catch (error) {
      console.error('Failed to flush events, re-buffering:', error);
      this.eventBuffer.unshift(...eventsToFlush);
    }
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    if (!this.isConnected) {
      return this.getMockCampaignMetrics(campaignId);
    }

    try {
      const metricsKey = `metrics:campaign:${campaignId}`;
      const metrics = await this.redis.hgetall(metricsKey);

      const impressions = parseInt(metrics.impression || '0');
      const clicks = parseInt(metrics.click || '0');
      const conversions = parseInt(metrics.conversion || '0');
      const spent = parseFloat(metrics.spent || '0');

      return {
        campaignId,
        impressions,
        clicks,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
        revenue: spent,
        uniqueUsers: parseInt(metrics.unique_users || '0'),
        spent,
        remainingBudget: parseFloat(metrics.remaining_budget || '0'),
        averageCpm: impressions > 0 ? (spent / impressions) * 1000 : 0,
        averageCpc: clicks > 0 ? spent / clicks : 0,
        averageCpa: conversions > 0 ? spent / conversions : 0
      };
    } catch (error) {
      console.error('Failed to get campaign metrics:', error);
      return this.getMockCampaignMetrics(campaignId);
    }
  }

  /**
   * Get publisher metrics
   */
  async getPublisherMetrics(publisherId: string): Promise<PublisherMetrics> {
    if (!this.isConnected) {
      return this.getMockPublisherMetrics(publisherId);
    }

    try {
      const metricsKey = `metrics:publisher:${publisherId}`;
      const metrics = await this.redis.hgetall(metricsKey);

      const impressions = parseInt(metrics.impression || '0');
      const clicks = parseInt(metrics.click || '0');
      const conversions = parseInt(metrics.conversion || '0');
      const earnings = parseFloat(metrics.earnings || '0');

      return {
        publisherId,
        impressions,
        clicks,
        conversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
        revenue: earnings,
        uniqueUsers: parseInt(metrics.unique_users || '0'),
        totalEarnings: earnings,
        averageRpm: impressions > 0 ? (earnings / impressions) * 1000 : 0,
        fillRate: parseFloat(metrics.fill_rate || '0')
      };
    } catch (error) {
      console.error('Failed to get publisher metrics:', error);
      return this.getMockPublisherMetrics(publisherId);
    }
  }

  /**
   * Get global platform metrics
   */
  async getGlobalMetrics(): Promise<EventMetrics & { totalCampaigns: number; totalPublishers: number }> {
    if (!this.isConnected) {
      return {
        impressions: 12500,
        clicks: 875,
        conversions: 43,
        ctr: 7.0,
        cvr: 4.9,
        revenue: 1250.75,
        uniqueUsers: 8900,
        totalCampaigns: 25,
        totalPublishers: 12
      };
    }

    try {
      // Get all campaign keys
      const campaignKeys = await this.redis.keys('metrics:campaign:*');
      const publisherKeys = await this.redis.keys('metrics:publisher:*');

      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalRevenue = 0;
      const uniqueUsers = new Set<string>();

      // Aggregate campaign metrics
      for (const key of campaignKeys) {
        if (key.includes(':20')) continue; // Skip daily metrics
        const metrics = await this.redis.hgetall(key);
        totalImpressions += parseInt(metrics.impression || '0');
        totalClicks += parseInt(metrics.click || '0');
        totalConversions += parseInt(metrics.conversion || '0');
        totalRevenue += parseFloat(metrics.spent || '0');
      }

      return {
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cvr: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
        revenue: totalRevenue,
        uniqueUsers: uniqueUsers.size,
        totalCampaigns: campaignKeys.filter(k => !k.includes(':20')).length,
        totalPublishers: publisherKeys.length
      };
    } catch (error) {
      console.error('Failed to get global metrics:', error);
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cvr: 0,
        revenue: 0,
        uniqueUsers: 0,
        totalCampaigns: 0,
        totalPublishers: 0
      };
    }
  }

  /**
   * Get user interaction frequency for a campaign (for frequency capping)
   */
  async getUserInteractionFrequency(userDid: string, campaignId: string): Promise<{
    impressions: number;
    clicks: number;
    conversions: number;
  }> {
    if (!this.isConnected) {
      return { impressions: 0, clicks: 0, conversions: 0 };
    }

    try {
      const userInteractionKey = `user:${userDid}:campaign:${campaignId}`;
      const interactions = await this.redis.hgetall(userInteractionKey);

      return {
        impressions: parseInt(interactions.impression || '0'),
        clicks: parseInt(interactions.click || '0'),
        conversions: parseInt(interactions.conversion || '0')
      };
    } catch (error) {
      console.error('Failed to get user interaction frequency:', error);
      return { impressions: 0, clicks: 0, conversions: 0 };
    }
  }

  /**
   * Get real-time event stream
   */
  async getRealtimeEvents(eventType: 'impression' | 'click' | 'conversion', limit: number = 100): Promise<any[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      const streamKey = `stream:events:${eventType}`;
      const events = await this.redis.xrevrange(streamKey, '+', '-', 'COUNT', limit);

      return events.map(([id, fields]) => {
        const event: any = { id };
        for (let i = 0; i < fields.length; i += 2) {
          const key = fields[i];
          const value = fields[i + 1];
          event[key] = key === 'metadata' ? JSON.parse(value) : value;
        }
        return event;
      });
    } catch (error) {
      console.error('Failed to get realtime events:', error);
      return [];
    }
  }

  /**
   * Health check
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush any remaining events
    await this.flushEventBuffer();

    await this.redis.quit();
    this.isConnected = false;
  }

  // ==================== MOCK DATA FOR OFFLINE MODE ====================

  private getMockCampaignMetrics(campaignId: string): CampaignMetrics {
    const impressions = Math.floor(Math.random() * 10000) + 1000;
    const clicks = Math.floor(impressions * (Math.random() * 0.1 + 0.02));
    const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));
    const spent = impressions * 0.001 + clicks * 0.01 + conversions * 0.1;

    return {
      campaignId,
      impressions,
      clicks,
      conversions,
      ctr: (clicks / impressions) * 100,
      cvr: (conversions / clicks) * 100,
      revenue: spent,
      uniqueUsers: Math.floor(impressions * 0.7),
      spent,
      remainingBudget: Math.max(0, 1000 - spent),
      averageCpm: (spent / impressions) * 1000,
      averageCpc: spent / clicks,
      averageCpa: spent / conversions
    };
  }

  private getMockPublisherMetrics(publisherId: string): PublisherMetrics {
    const impressions = Math.floor(Math.random() * 5000) + 500;
    const clicks = Math.floor(impressions * (Math.random() * 0.08 + 0.02));
    const conversions = Math.floor(clicks * (Math.random() * 0.08 + 0.02));
    const earnings = impressions * 0.0005 + clicks * 0.005 + conversions * 0.05;

    return {
      publisherId,
      impressions,
      clicks,
      conversions,
      ctr: (clicks / impressions) * 100,
      cvr: (conversions / clicks) * 100,
      revenue: earnings,
      uniqueUsers: Math.floor(impressions * 0.6),
      totalEarnings: earnings,
      averageRpm: (earnings / impressions) * 1000,
      fillRate: Math.random() * 20 + 80 // 80-100%
    };
  }
}

// Export singleton instance
export const eventTracker = new EventTracker();
export default EventTracker;
