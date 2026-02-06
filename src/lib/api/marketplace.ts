import { supabase } from '@/lib/supabase';

export const marketplaceAPI = {
  requestAd: async (adRequest: { publisherId: string; slotId: string; userId?: string }) => {
    // Get active campaigns that match the request
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*, ad_creatives(*)')
      .eq('status', 'active')
      .gt('budget', 0)
      .limit(10);

    if (error) throw error;

    // Simple matching logic - in production this would be ML-based
    if (campaigns && campaigns.length > 0) {
      const selectedCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      return {
        campaign: selectedCampaign,
        creative: selectedCampaign.ad_creatives?.[0] || null,
      };
    }

    return null;
  },

  getActiveCampaigns: async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .gt('budget', 0);
    if (error) throw error;
    return data;
  }
};
