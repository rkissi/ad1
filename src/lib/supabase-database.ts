import { supabase } from '@/lib/supabase';
import type { 
  Profile, 
  Campaign, 
  Publisher, 
  Advertiser, 
  Event, 
  Transaction, 
  UserReward,
  AdCreative,
  Consent,
  CampaignStatus,
  EventType
} from '@/types/supabase';

// ============================================
// PROFILE OPERATIONS
// ============================================

export const profileService = {
  async getById(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  async getByEmail(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) return null;
    return data;
  },

  async update(id: string, updates: Partial<Profile>): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTokenBalance(id: string, amount: number): Promise<void> {
    const { error } = await supabase.rpc('increment_token_balance', {
      user_id: id,
      amount: amount
    });
    
    if (error) throw error;
  }
};

// ============================================
// CAMPAIGN OPERATIONS
// ============================================

export const campaignService = {
  async create(campaign: Partial<Campaign>): Promise<Campaign> {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaign)
      .select()
      .single();
    
    if (error) throw error;
    return data;
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

  async getByAdvertiser(advertiserId: string): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('advertiser_id', advertiserId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getActive(): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .gt('budget', 0)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
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

  async updateStatus(id: string, status: CampaignStatus): Promise<void> {
    const { error } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async incrementMetric(id: string, metric: 'impressions' | 'clicks' | 'conversions'): Promise<void> {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select(metric)
      .eq('id', id)
      .single();
    
    if (campaign) {
      await supabase
        .from('campaigns')
        .update({ [metric]: (campaign[metric] || 0) + 1 })
        .eq('id', id);
    }
  }
};

// ============================================
// EVENT OPERATIONS
// ============================================

export const eventService = {
  async create(event: Partial<Event>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async trackImpression(data: {
    campaign_id: string;
    user_id?: string;
    publisher_id?: string;
    ad_id?: string;
    slot_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Event> {
    return this.create({
      ...data,
      type: 'impression' as EventType,
    });
  },

  async trackClick(data: {
    campaign_id: string;
    user_id?: string;
    publisher_id?: string;
    ad_id?: string;
    slot_id?: string;
    metadata?: Record<string, any>;
  }): Promise<Event> {
    return this.create({
      ...data,
      type: 'click' as EventType,
    });
  },

  async trackConversion(data: {
    campaign_id: string;
    user_id?: string;
    publisher_id?: string;
    ad_id?: string;
    metadata?: Record<string, any>;
    reward_amount?: number;
  }): Promise<Event> {
    return this.create({
      ...data,
      type: 'conversion' as EventType,
    });
  },

  async getByCampaign(campaignId: string, limit = 100): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async getByUser(userId: string, limit = 100): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async getByPublisher(publisherId: string, limit = 100): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('publisher_id', publisherId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
};

// ============================================
// PUBLISHER OPERATIONS
// ============================================

export const publisherService = {
  async create(publisher: Partial<Publisher>): Promise<Publisher> {
    // Generate API key
    const apiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    const { data, error } = await supabase
      .from('publishers')
      .insert({ ...publisher, api_key: apiKey })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Publisher | null> {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
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

  async getByApiKey(apiKey: string): Promise<Publisher | null> {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('api_key', apiKey)
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

  async updateMetrics(id: string, impressions: number, clicks: number, earnings: number): Promise<void> {
    const { data: publisher } = await supabase
      .from('publishers')
      .select('total_impressions, total_clicks, total_earnings')
      .eq('id', id)
      .single();
    
    if (publisher) {
      await supabase
        .from('publishers')
        .update({
          total_impressions: publisher.total_impressions + impressions,
          total_clicks: publisher.total_clicks + clicks,
          total_earnings: publisher.total_earnings + earnings,
        })
        .eq('id', id);
    }
  }
};

// ============================================
// ADVERTISER OPERATIONS
// ============================================

export const advertiserService = {
  async create(advertiser: Partial<Advertiser>): Promise<Advertiser> {
    const { data, error } = await supabase
      .from('advertisers')
      .insert(advertiser)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getById(id: string): Promise<Advertiser | null> {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return null;
    return data;
  },

  async getByUserId(userId: string): Promise<Advertiser | null> {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) return null;
    return data;
  },

  async update(id: string, updates: Partial<Advertiser>): Promise<Advertiser> {
    const { data, error } = await supabase
      .from('advertisers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ============================================
// TRANSACTION OPERATIONS
// ============================================

export const transactionService = {
  async create(transaction: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async updateStatus(id: string, status: Transaction['status']): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
  }
};

// ============================================
// REWARDS OPERATIONS
// ============================================

export const rewardService = {
  async create(reward: Partial<UserReward>): Promise<UserReward> {
    const { data, error } = await supabase
      .from('user_rewards')
      .insert(reward)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByUser(userId: string): Promise<UserReward[]> {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async getTotalEarned(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed');
    
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  },

  async getPending(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending');
    
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  }
};

// ============================================
// CONSENT OPERATIONS
// ============================================

export const consentService = {
  async grant(consent: Partial<Consent>): Promise<Consent> {
    const { data, error } = await supabase
      .from('consents')
      .insert(consent)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async revoke(id: string): Promise<void> {
    const { error } = await supabase
      .from('consents')
      .update({ 
        is_active: false, 
        revoked_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  async getByUser(userId: string): Promise<Consent[]> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data || [];
  },

  async hasConsent(userId: string, scope: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('consents')
      .select('id')
      .eq('user_id', userId)
      .eq('scope', scope)
      .eq('is_active', true)
      .single();
    
    return !error && !!data;
  }
};

// ============================================
// AD CREATIVE OPERATIONS
// ============================================

export const creativeService = {
  async create(creative: Partial<AdCreative>): Promise<AdCreative> {
    const { data, error } = await supabase
      .from('ad_creatives')
      .insert(creative)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByCampaign(campaignId: string): Promise<AdCreative[]> {
    const { data, error } = await supabase
      .from('ad_creatives')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true);
    
    if (error) throw error;
    return data || [];
  },

  async update(id: string, updates: Partial<AdCreative>): Promise<AdCreative> {
    const { data, error } = await supabase
      .from('ad_creatives')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ad_creatives')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// ============================================
// ANALYTICS OPERATIONS
// ============================================

export const analyticsService = {
  async getAdvertiserStats(advertiserId: string) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('impressions, clicks, conversions, spent, budget, status')
      .eq('advertiser_id', advertiserId);
    
    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
    const totalImpressions = campaigns?.reduce((sum, c) => sum + c.impressions, 0) || 0;
    const totalClicks = campaigns?.reduce((sum, c) => sum + c.clicks, 0) || 0;
    const totalConversions = campaigns?.reduce((sum, c) => sum + c.conversions, 0) || 0;
    const totalSpent = campaigns?.reduce((sum, c) => sum + c.spent, 0) || 0;
    const totalBudget = campaigns?.reduce((sum, c) => sum + c.budget, 0) || 0;
    
    return {
      totalCampaigns: campaigns?.length || 0,
      activeCampaigns,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpent,
      totalBudget,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    };
  },

  async getPublisherStats(publisherId: string) {
    const { data: publisher } = await supabase
      .from('publishers')
      .select('total_impressions, total_clicks, total_earnings')
      .eq('id', publisherId)
      .single();
    
    return {
      totalImpressions: publisher?.total_impressions || 0,
      totalClicks: publisher?.total_clicks || 0,
      totalEarnings: publisher?.total_earnings || 0,
      ctr: publisher?.total_impressions > 0 
        ? (publisher.total_clicks / publisher.total_impressions) * 100 
        : 0,
    };
  },

  async getUserStats(userId: string) {
    const [totalEarned, pendingRewards, profile] = await Promise.all([
      rewardService.getTotalEarned(userId),
      rewardService.getPending(userId),
      profileService.getById(userId),
    ]);
    
    return {
      totalEarned,
      pendingRewards,
      tokenBalance: profile?.token_balance || 0,
    };
  },

  async getPlatformStats() {
    const [
      { count: totalUsers },
      { count: totalCampaigns },
      { count: totalPublishers },
      { count: activeCampaigns },
      { data: transactions }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('publishers').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('transactions').select('amount').eq('status', 'completed'),
    ]);

    return {
      totalUsers: totalUsers || 0,
      totalCampaigns: totalCampaigns || 0,
      totalPublishers: totalPublishers || 0,
      activeCampaigns: activeCampaigns || 0,
      totalRevenue: transactions?.reduce((sum, t) => sum + t.amount, 0) || 0,
    };
  }
};

// ============================================
// AD MATCHING SERVICE
// ============================================

export const adMatchingService = {
  async matchAd(request: {
    publisherId: string;
    slotId: string;
    userId?: string;
    userInterests?: string[];
    context?: Record<string, any>;
  }) {
    // Get active campaigns
    const campaigns = await campaignService.getActive();
    
    if (campaigns.length === 0) {
      return null;
    }

    // Simple matching logic - in production this would use ML
    let bestMatch = campaigns[0];
    let bestScore = 0;

    for (const campaign of campaigns) {
      let score = 0;
      
      // Check budget
      if (campaign.budget > campaign.spent) {
        score += 10;
      }
      
      // Check audience targeting
      const audienceSpec = campaign.audience_spec as any;
      if (audienceSpec?.interests && request.userInterests) {
        const matchingInterests = audienceSpec.interests.filter(
          (i: string) => request.userInterests?.includes(i)
        );
        score += matchingInterests.length * 5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = campaign;
      }
    }

    // Get creative for the campaign
    const creatives = await creativeService.getByCampaign(bestMatch.id);
    
    return {
      campaign: bestMatch,
      creative: creatives[0] || null,
      score: bestScore,
    };
  }
};

export default {
  profile: profileService,
  campaign: campaignService,
  event: eventService,
  publisher: publisherService,
  advertiser: advertiserService,
  transaction: transactionService,
  reward: rewardService,
  consent: consentService,
  creative: creativeService,
  analytics: analyticsService,
  adMatching: adMatchingService,
};
