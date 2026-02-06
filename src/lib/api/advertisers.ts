import { supabase } from '@/lib/supabase';

export const advertiserAPI = {
  create: async (advertiserData: any) => {
    const { data, error } = await supabase
      .from('advertisers')
      .insert(advertiserData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
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
