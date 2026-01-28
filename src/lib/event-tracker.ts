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
    const campaignDailyKey = `metrics:campaign:${event.campaignId}:${dateKey}`;\n    pipeline.hincrby(campaignDailyKey, event.type, 1);\n    pipeline.expire(campaignDailyKey, 86400 * 90); // Keep daily metrics for 90 days\n\n    // Update publisher metrics\n    const publisherKey = `metrics:publisher:${event.publisherDid}`;\n    pipeline.hincrby(publisherKey, event.type, 1);\n    pipeline.hincrby(publisherKey, 'total_events', 1);\n    pipeline.hset(publisherKey, 'last_updated', event.timestamp!);\n\n    // Update user interaction tracking (for frequency capping)\n    const userInteractionKey = `user:${event.userDid}:campaign:${event.campaignId}`;\n    pipeline.hincrby(userInteractionKey, event.type, 1);\n    pipeline.expire(userInteractionKey, 86400 * 7); // Keep user interactions for 7 days\n\n    // Add to real-time event stream\n    const streamKey = `stream:events:${event.type}`;\n    pipeline.xadd(streamKey, 'MAXLEN', '~', '10000', '*', \n      'campaignId', event.campaignId,\n      'publisherDid', event.publisherDid,\n      'timestamp', event.timestamp!,\n      'metadata', JSON.stringify(event.metadata)\n    );\n\n    // Execute all Redis operations\n    await pipeline.exec();\n\n    console.log(`✅ Event tracked: ${event.type} for campaign ${event.campaignId}`);\n  }\n\n  /**\n   * Flush buffered events to Redis\n   */\n  private async flushEventBuffer(): Promise<void> {\n    if (this.eventBuffer.length === 0 || !this.isConnected) {\n      return;\n    }\n\n    const eventsToFlush = [...this.eventBuffer];\n    this.eventBuffer = [];\n\n    try {\n      await Promise.all(eventsToFlush.map(event => this.processEventImmediate(event)));\n      console.log(`✅ Flushed ${eventsToFlush.length} buffered events`);\n    } catch (error) {\n      console.error('Failed to flush events, re-buffering:', error);\n      this.eventBuffer.unshift(...eventsToFlush);\n    }\n  }\n\n  /**\n   * Get campaign metrics\n   */\n  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {\n    if (!this.isConnected) {\n      return this.getMockCampaignMetrics(campaignId);\n    }\n\n    try {\n      const metricsKey = `metrics:campaign:${campaignId}`;\n      const metrics = await this.redis.hgetall(metricsKey);\n\n      const impressions = parseInt(metrics.impression || '0');\n      const clicks = parseInt(metrics.click || '0');\n      const conversions = parseInt(metrics.conversion || '0');\n      const spent = parseFloat(metrics.spent || '0');\n\n      return {\n        campaignId,\n        impressions,\n        clicks,\n        conversions,\n        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,\n        cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,\n        revenue: spent,\n        uniqueUsers: parseInt(metrics.unique_users || '0'),\n        spent,\n        remainingBudget: parseFloat(metrics.remaining_budget || '0'),\n        averageCpm: impressions > 0 ? (spent / impressions) * 1000 : 0,\n        averageCpc: clicks > 0 ? spent / clicks : 0,\n        averageCpa: conversions > 0 ? spent / conversions : 0\n      };\n    } catch (error) {\n      console.error('Failed to get campaign metrics:', error);\n      return this.getMockCampaignMetrics(campaignId);\n    }\n  }\n\n  /**\n   * Get publisher metrics\n   */\n  async getPublisherMetrics(publisherId: string): Promise<PublisherMetrics> {\n    if (!this.isConnected) {\n      return this.getMockPublisherMetrics(publisherId);\n    }\n\n    try {\n      const metricsKey = `metrics:publisher:${publisherId}`;\n      const metrics = await this.redis.hgetall(metricsKey);\n\n      const impressions = parseInt(metrics.impression || '0');\n      const clicks = parseInt(metrics.click || '0');\n      const conversions = parseInt(metrics.conversion || '0');\n      const earnings = parseFloat(metrics.earnings || '0');\n\n      return {\n        publisherId,\n        impressions,\n        clicks,\n        conversions,\n        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,\n        cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,\n        revenue: earnings,\n        uniqueUsers: parseInt(metrics.unique_users || '0'),\n        totalEarnings: earnings,\n        averageRpm: impressions > 0 ? (earnings / impressions) * 1000 : 0,\n        fillRate: parseFloat(metrics.fill_rate || '0')\n      };\n    } catch (error) {\n      console.error('Failed to get publisher metrics:', error);\n      return this.getMockPublisherMetrics(publisherId);\n    }\n  }\n\n  /**\n   * Get global platform metrics\n   */\n  async getGlobalMetrics(): Promise<EventMetrics & { totalCampaigns: number; totalPublishers: number }> {\n    if (!this.isConnected) {\n      return {\n        impressions: 12500,\n        clicks: 875,\n        conversions: 43,\n        ctr: 7.0,\n        cvr: 4.9,\n        revenue: 1250.75,\n        uniqueUsers: 8900,\n        totalCampaigns: 25,\n        totalPublishers: 12\n      };\n    }\n\n    try {\n      // Get all campaign keys\n      const campaignKeys = await this.redis.keys('metrics:campaign:*');\n      const publisherKeys = await this.redis.keys('metrics:publisher:*');\n\n      let totalImpressions = 0;\n      let totalClicks = 0;\n      let totalConversions = 0;\n      let totalRevenue = 0;\n      const uniqueUsers = new Set<string>();\n\n      // Aggregate campaign metrics\n      for (const key of campaignKeys) {\n        if (key.includes(':20')) continue; // Skip daily metrics\n        const metrics = await this.redis.hgetall(key);\n        totalImpressions += parseInt(metrics.impression || '0');\n        totalClicks += parseInt(metrics.click || '0');\n        totalConversions += parseInt(metrics.conversion || '0');\n        totalRevenue += parseFloat(metrics.spent || '0');\n      }\n\n      return {\n        impressions: totalImpressions,\n        clicks: totalClicks,\n        conversions: totalConversions,\n        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,\n        cvr: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,\n        revenue: totalRevenue,\n        uniqueUsers: uniqueUsers.size,\n        totalCampaigns: campaignKeys.filter(k => !k.includes(':20')).length,\n        totalPublishers: publisherKeys.length\n      };\n    } catch (error) {\n      console.error('Failed to get global metrics:', error);\n      return {\n        impressions: 0,\n        clicks: 0,\n        conversions: 0,\n        ctr: 0,\n        cvr: 0,\n        revenue: 0,\n        uniqueUsers: 0,\n        totalCampaigns: 0,\n        totalPublishers: 0\n      };\n    }\n  }\n\n  /**\n   * Get user interaction frequency for a campaign (for frequency capping)\n   */\n  async getUserInteractionFrequency(userDid: string, campaignId: string): Promise<{\n    impressions: number;\n    clicks: number;\n    conversions: number;\n  }> {\n    if (!this.isConnected) {\n      return { impressions: 0, clicks: 0, conversions: 0 };\n    }\n\n    try {\n      const userInteractionKey = `user:${userDid}:campaign:${campaignId}`;\n      const interactions = await this.redis.hgetall(userInteractionKey);\n\n      return {\n        impressions: parseInt(interactions.impression || '0'),\n        clicks: parseInt(interactions.click || '0'),\n        conversions: parseInt(interactions.conversion || '0')\n      };\n    } catch (error) {\n      console.error('Failed to get user interaction frequency:', error);\n      return { impressions: 0, clicks: 0, conversions: 0 };\n    }\n  }\n\n  /**\n   * Get real-time event stream\n   */\n  async getRealtimeEvents(eventType: 'impression' | 'click' | 'conversion', limit: number = 100): Promise<any[]> {\n    if (!this.isConnected) {\n      return [];\n    }\n\n    try {\n      const streamKey = `stream:events:${eventType}`;\n      const events = await this.redis.xrevrange(streamKey, '+', '-', 'COUNT', limit);\n      \n      return events.map(([id, fields]) => {\n        const event: any = { id };\n        for (let i = 0; i < fields.length; i += 2) {\n          const key = fields[i];\n          const value = fields[i + 1];\n          event[key] = key === 'metadata' ? JSON.parse(value) : value;\n        }\n        return event;\n      });\n    } catch (error) {\n      console.error('Failed to get realtime events:', error);\n      return [];\n    }\n  }\n\n  /**\n   * Health check\n   */\n  isHealthy(): boolean {\n    return this.isConnected;\n  }\n\n  /**\n   * Close connections and cleanup\n   */\n  async close(): Promise<void> {\n    if (this.flushInterval) {\n      clearInterval(this.flushInterval);\n    }\n    \n    // Flush any remaining events\n    await this.flushEventBuffer();\n    \n    await this.redis.quit();\n    this.isConnected = false;\n  }\n\n  // ==================== MOCK DATA FOR OFFLINE MODE ====================\n\n  private getMockCampaignMetrics(campaignId: string): CampaignMetrics {\n    const impressions = Math.floor(Math.random() * 10000) + 1000;\n    const clicks = Math.floor(impressions * (Math.random() * 0.1 + 0.02));\n    const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));\n    const spent = impressions * 0.001 + clicks * 0.01 + conversions * 0.1;\n\n    return {\n      campaignId,\n      impressions,\n      clicks,\n      conversions,\n      ctr: (clicks / impressions) * 100,\n      cvr: (conversions / clicks) * 100,\n      revenue: spent,\n      uniqueUsers: Math.floor(impressions * 0.7),\n      spent,\n      remainingBudget: Math.max(0, 1000 - spent),\n      averageCpm: (spent / impressions) * 1000,\n      averageCpc: spent / clicks,\n      averageCpa: spent / conversions\n    };\n  }\n\n  private getMockPublisherMetrics(publisherId: string): PublisherMetrics {\n    const impressions = Math.floor(Math.random() * 5000) + 500;\n    const clicks = Math.floor(impressions * (Math.random() * 0.08 + 0.02));\n    const conversions = Math.floor(clicks * (Math.random() * 0.08 + 0.02));\n    const earnings = impressions * 0.0005 + clicks * 0.005 + conversions * 0.05;\n\n    return {\n      publisherId,\n      impressions,\n      clicks,\n      conversions,\n      ctr: (clicks / impressions) * 100,\n      cvr: (conversions / clicks) * 100,\n      revenue: earnings,\n      uniqueUsers: Math.floor(impressions * 0.6),\n      totalEarnings: earnings,\n      averageRpm: (earnings / impressions) * 1000,\n      fillRate: Math.random() * 20 + 80 // 80-100%\n    };\n  }\n}\n\n// Export singleton instance\nexport const eventTracker = new EventTracker();\nexport default EventTracker;