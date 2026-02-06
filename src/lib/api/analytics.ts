import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/supabase';

export const analyticsAPI = {
  getDashboardStats: async (userId: string, role: UserRole) => {
    if (role === 'advertiser') {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('impressions, clicks, conversions, spent, budget')
        .eq('advertiser_id', userId);

      return {
        totalCampaigns: campaigns?.length || 0,
        totalImpressions: campaigns?.reduce((sum, c) => sum + c.impressions, 0) || 0,
        totalClicks: campaigns?.reduce((sum, c) => sum + c.clicks, 0) || 0,
        totalConversions: campaigns?.reduce((sum, c) => sum + c.conversions, 0) || 0,
        totalSpent: campaigns?.reduce((sum, c) => sum + c.spent, 0) || 0,
      };
    } else if (role === 'publisher') {
      const { data: publisher } = await supabase
        .from('publishers')
        .select('total_impressions, total_clicks, total_earnings')
        .eq('user_id', userId)
        .single();

      return {
        totalImpressions: publisher?.total_impressions || 0,
        totalClicks: publisher?.total_clicks || 0,
        totalEarnings: publisher?.total_earnings || 0,
      };
    } else if (role === 'user') {
      const { data: rewards } = await supabase
        .from('user_rewards')
        .select('amount, status')
        .eq('user_id', userId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', userId)
        .single();

      return {
        totalEarned: rewards?.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0) || 0,
        pendingRewards: rewards?.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0) || 0,
        tokenBalance: profile?.token_balance || 0,
      };
    }

    return {};
  },

  getAdminStats: async () => {
    const [
      { count: totalUsers },
      { count: totalCampaigns },
      { count: totalPublishers },
      { data: transactions }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('publishers').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('amount').eq('status', 'completed'),
    ]);

    return {
      totalUsers: totalUsers || 0,
      totalCampaigns: totalCampaigns || 0,
      totalPublishers: totalPublishers || 0,
      totalRevenue: transactions?.reduce((sum, t) => sum + t.amount, 0) || 0,
    };
  }
};
