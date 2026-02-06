import { supabase } from '@/lib/supabase';

export const publisherAPI = {
  create: async (publisherData: any) => {
    const { data, error } = await supabase
      .from('publishers')
      .insert(publisherData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('publishers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getMetrics: async (id: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('total_impressions, total_clicks, total_earnings')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getEvents: async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('publisher_id', id)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};
