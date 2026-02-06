import { supabase } from '@/lib/supabase';

export const settingsAPI = {
  get: async (key: string) => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) throw error;
    return data?.value;
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*');
    if (error) throw error;
    return data;
  }
};
