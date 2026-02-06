import { supabase } from '@/lib/supabase';

export const eventAPI = {
  trackImpression: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'impression' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  trackClick: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'click' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  trackConversion: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'conversion' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  batchTrack: async (events: any[]) => {
    const { data, error } = await supabase
      .from('events')
      .insert(events)
      .select();
    if (error) throw error;
    return data;
  },

  getUserEvents: async (userId: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};
