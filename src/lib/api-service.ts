// Unified API Service for Metaverse Advertising Platform
// Provides a single interface for all backend operations

import { supabase } from '@/lib/supabase';
import { marketplaceService } from '@/lib/marketplace-service';
import type { Campaign, Publisher, Profile, Event, Transaction, UserReward, Consent } from '@/types/supabase';

// Re-export marketplace service
export { marketplaceService };

// Campaign Service
export const CampaignService = {
  async create(data: Partial<Campaign>): Promise<Campaign> {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return campaign;
  },

  async getAll(advertiserId?: string): Promise<Campaign[]> {
    let query = supabase.from('campaigns').select('*');
    if (advertiserId) {
      query = query.eq('advertiser_id', advertiserId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Campaign | null> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  async update(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) throw error;
  },

  async activate(id: string): Promise<Campaign> {
    return this.update(id, { status: 'active' as any });
  },

  async pause(id: string): Promise<Campaign> {
    return this.update(id, { status: 'paused' as any });
  },

  async getMetrics(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('impressions, clicks, conversions, ctr, spent, budget')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
};

// Publisher Service
export const PublisherService = {
  async create(data: Partial<Publisher>): Promise<Publisher> {
    const { data: publisher, error } = await supabase
      .from('publishers')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return publisher;
  },

  async getByUserId(userId: string): Promise<Publisher | null> {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async update(id: string, updates: Partial<Publisher>): Promise<Publisher> {
    const { data, error } = await supabase
      .from('publishers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async generateApiKey(id: string): Promise<string> {
    const apiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    await this.update(id, { api_key: apiKey });
    return apiKey;
  }
};

// User Service
export const UserService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getRewards(userId: string): Promise<UserReward[]> {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
};

// Event Service
export const EventService = {
  async track(eventData: Partial<Event>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async trackImpression(campaignId: string, publisherId?: string, userId?: string): Promise<Event> {
    return this.track({
      type: 'impression' as any,
      campaign_id: campaignId,
      publisher_id: publisherId,
      user_id: userId
    });
  },

  async trackClick(campaignId: string, publisherId?: string, userId?: string): Promise<Event> {
    return this.track({
      type: 'click' as any,
      campaign_id: campaignId,
      publisher_id: publisherId,
      user_id: userId
    });
  },

  async trackConversion(campaignId: string, publisherId?: string, userId?: string): Promise<Event> {
    return this.track({
      type: 'conversion' as any,
      campaign_id: campaignId,
      publisher_id: publisherId,
      user_id: userId
    });
  },

  async getByUser(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async getByCampaign(campaignId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  }
};

// Consent Service
export const ConsentService = {
  async grant(userId: string, scope: string, campaignId?: string): Promise<Consent> {
    return marketplaceService.grantConsent(userId, scope, campaignId);
  },

  async revoke(userId: string, scope?: string, consentId?: string): Promise<any> {
    return marketplaceService.revokeConsent(userId, scope, consentId);
  },

  async check(userId: string, scope: string): Promise<boolean> {
    return marketplaceService.checkConsent(userId, scope);
  },

  async list(userId: string): Promise<Consent[]> {
    return marketplaceService.listConsents(userId);
  }
};

// Analytics Service
export const AnalyticsService = {
  async getDashboardStats(userId: string, role: string): Promise<any> {
    const { data, error } = await supabase.functions.invoke('supabase-functions-analytics', {
      body: { action: 'dashboard', userId }
    });
    if (error) throw error;
    return data?.stats || {};
  },

  async getCampaignAnalytics(campaignId: string, dateRange?: { start: string; end: string }): Promise<any> {
    const { data, error } = await supabase.functions.invoke('supabase-functions-analytics', {
      body: { action: 'campaign', campaignId, dateRange }
    });
    if (error) throw error;
    return data;
  },

  async getPublisherAnalytics(publisherId: string, dateRange?: { start: string; end: string }): Promise<any> {
    const { data, error } = await supabase.functions.invoke('supabase-functions-analytics', {
      body: { action: 'publisher', publisherId, dateRange }
    });
    if (error) throw error;
    return data;
  },

  async getPlatformAnalytics(dateRange?: { start: string; end: string }): Promise<any> {
    const { data, error } = await supabase.functions.invoke('supabase-functions-analytics', {
      body: { action: 'platform', dateRange }
    });
    if (error) throw error;
    return data;
  }
};

// Payout Service
export const PayoutService = {
  async request(userId: string, amount: number, method: 'token' | 'voucher' | 'crypto' = 'token'): Promise<any> {
    return marketplaceService.requestPayout(userId, amount, method);
  },

  async getHistory(userId: string): Promise<any> {
    return marketplaceService.getPayoutHistory(userId);
  },

  async getStatus(userId: string, payoutId: string): Promise<any> {
    return marketplaceService.getPayoutStatus(userId, payoutId);
  }
};

// Export all services
export default {
  Campaign: CampaignService,
  Publisher: PublisherService,
  User: UserService,
  Event: EventService,
  Consent: ConsentService,
  Analytics: AnalyticsService,
  Payout: PayoutService,
  Marketplace: marketplaceService
};
