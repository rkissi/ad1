import jwt from 'jsonwebtoken';
import { supabaseServer } from '../lib/supabase-server';
import { DatabaseService } from '../lib/database';

// Initialize DB service for legacy/custom table support if needed
const db = new DatabaseService();

export class AuthService {
  async verifyToken(token: string) {
    try {
      // First try to verify with Supabase Auth
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);

      if (user) {
        return {
          sub: user.id,
          email: user.email,
          role: user.user_metadata?.role || 'user',
          did: user.user_metadata?.did || `did:metaverse:${user.id}`, // Fallback DID
          ...user.user_metadata
        };
      }

      // Fallback: If using custom JWT secret (legacy)
      if (process.env.JWT_SECRET) {
        return jwt.verify(token, process.env.JWT_SECRET) as any;
      }

      return null;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  // Legacy/Custom registration (if needed by API, though frontend uses Supabase directly)
  async register(email: string, password: string, role: string) {
    const { data, error } = await supabaseServer.auth.signUp({
      email,
      password,
      options: {
        data: { role }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('Registration failed');

    return {
      user: {
        did: `did:metaverse:${data.user.id}`,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name,
        role: data.user.user_metadata?.role
      },
      token: data.session?.access_token
    };
  }

  async login(email: string, password: string) {
    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (!data.user || !data.session) throw new Error('Login failed');

    return {
      user: {
        did: `did:metaverse:${data.user.id}`,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name,
        role: data.user.user_metadata?.role
      },
      token: data.session.access_token
    };
  }
}

export class UserService {
  async getProfile(userId: string) {
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updatePreferences(userId: string, preferences: any) {
    const { data, error } = await supabaseServer
      .from('profiles')
      .update(preferences)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createConsent(userId: string, scope: string, campaignId?: string) {
    const { data, error } = await supabaseServer
      .from('consents')
      .insert({
        user_id: userId,
        scope,
        campaign_id: campaignId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserConsents(userId: string) {
    const { data, error } = await supabaseServer
      .from('consents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;
    return data;
  }

  async getUserEvents(userId: string) {
    const { data, error } = await supabaseServer
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data;
  }
}

export class OnboardingService {
  async getStatus(userId: string) {
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('onboarding_status, onboarding_step')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async start(userId: string) {
    const { data, error } = await supabaseServer
      .from('profiles')
      .update({ onboarding_status: 'in_progress' })
      .eq('id', userId)
      .select('onboarding_status')
      .single();

    if (error) throw error;
    return data;
  }

  async updateStep(userId: string, step: string, stepData: any, role: string) {
    // Update profile step
    const { error: profileError } = await supabaseServer
      .from('profiles')
      .update({ onboarding_step: step })
      .eq('id', userId);

    if (profileError) throw profileError;

    // Save step data to role-specific table
    let table = '';
    if (role === 'user') table = 'user_onboarding';
    else if (role === 'advertiser') table = 'advertiser_onboarding';
    else if (role === 'publisher') table = 'publisher_onboarding';

    if (table) {
      // Upsert data
      const { error: dataError } = await supabaseServer
        .from(table as any)
        .upsert({
          [role === 'advertiser' ? 'advertiser_id' : role === 'publisher' ? 'publisher_id' : 'user_id']: userId,
          ...stepData,
          updated_at: new Date().toISOString()
        });

      if (dataError) throw dataError;
    }

    return { success: true, step };
  }

  async complete(userId: string) {
    const { data, error } = await supabaseServer
      .from('profiles')
      .update({
        onboarding_status: 'completed',
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('onboarding_status')
      .single();

    if (error) throw error;
    return data;
  }
}

export class CampaignService {
  async createCampaign(userId: string, campaignData: any) {
    const { data, error } = await supabaseServer
      .from('campaigns')
      .insert({ ...campaignData, advertiser_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getCampaign(id: string) {
    const { data, error } = await supabaseServer
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async getCampaignsByAdvertiser(userId: string) {
    const { data, error } = await supabaseServer
      .from('campaigns')
      .select('*')
      .eq('advertiser_id', userId);
    if (error) throw error;
    return data;
  }

  async updateCampaign(id: string, updates: any) {
    const { data, error } = await supabaseServer
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export class MatchingService {
  async findMatchingAds(request: any) {
    // Basic implementation: find active campaign with budget
    const { data: campaigns } = await supabaseServer
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .gt('budget', 0)
      .limit(5);

    if (campaigns && campaigns.length > 0) {
      // Random selection
      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      return {
        adId: `ad_${Math.random().toString(36).substr(2, 9)}`,
        campaignId: campaign.id,
        bid: 0.1,
        currency: campaign.currency,
        creative: campaign.creative_manifest // This assumes creative_manifest is the creative data
      };
    }
    return null;
  }
}

export class EventService {
  async recordEvent(type: string, data: any) {
    const { data: event, error } = await supabaseServer
      .from('events')
      .insert({
        type: type as any,
        campaign_id: data.campaignId,
        user_id: data.userDid, // Assuming userDid maps to user_id (UUID)
        publisher_id: data.publisherDid,
        slot_id: data.slotId,
        metadata: data.metadata,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return event;
  }

  async batchRecordEvents(events: any[]) {
    const { data, error } = await supabaseServer
      .from('events')
      .insert(events.map(e => ({
        type: e.type,
        campaign_id: e.campaignId,
        user_id: e.userDid,
        publisher_id: e.publisherDid,
        slot_id: e.slotId,
        metadata: e.metadata
      })))
      .select();

    if (error) throw error;
    return data;
  }

  async getEventsByCampaign(campaignId: string) {
    const { data, error } = await supabaseServer
      .from('events')
      .select('*')
      .eq('campaign_id', campaignId);
    if (error) throw error;
    return data;
  }
}

export class PublisherService {
  async verifyPublisher(publisherId: string) {
    // Logic to verify publisher domain/setup
    return { verified: true };
  }

  async getPublisher(id: string) {
    const { data, error } = await supabaseServer
      .from('publishers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
}
