import { supabase } from '@/lib/supabase';

export const creativesAPI = {
  create: async (creativeData: any) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .insert(creativeData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getByCampaign: async (campaignId: string) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .select('*')
      .eq('campaign_id', campaignId);
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('ad_creatives')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
