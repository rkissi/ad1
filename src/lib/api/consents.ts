import { supabase } from '@/lib/supabase';

export const consentAPI = {
  getUserConsents: async (userId: string) => {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },

  grantConsent: async (consentData: any) => {
    const { data, error } = await supabase
      .from('consents')
      .insert(consentData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  revokeConsent: async (consentId: string) => {
    const { data, error } = await supabase
      .from('consents')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', consentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
