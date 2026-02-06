import { supabase } from '@/lib/supabase';

export const campaignAPI = {
  create: async (campaignData: any) => {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getAll: async (advertiserId?: string) => {
    let query = supabase.from('campaigns').select('*');
    if (advertiserId) {
      query = query.eq('advertiser_id', advertiserId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  getMetrics: async (id: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('impressions, clicks, conversions, ctr, spent, budget')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getEvents: async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('campaign_id', id)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};
