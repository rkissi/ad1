import { supabase } from '@/lib/supabase';

export const rewardsAPI = {
  getUserRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getTotalRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed');
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  },

  getPendingRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  }
};
