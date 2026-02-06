import { supabase } from '@/lib/supabase';

export const transactionsAPI = {
  getAll: async (userId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (transactionData: any) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
