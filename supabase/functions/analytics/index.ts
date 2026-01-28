import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyticsRequest {
  action: 'dashboard' | 'campaign' | 'publisher' | 'user' | 'platform'
  userId?: string
  campaignId?: string
  publisherId?: string
  dateRange?: {
    start: string
    end: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const request: AnalyticsRequest = await req.json()
    const { action, userId, campaignId, publisherId, dateRange } = request

    // Build date filter
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = dateRange?.end || new Date().toISOString()

    switch (action) {
      case 'dashboard': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'User ID required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Get user profile to determine role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

        if (!profile) {
          return new Response(
            JSON.stringify({ error: 'User not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        let stats: any = {}

        if (profile.role === 'advertiser') {
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('*')
            .eq('advertiser_id', userId)

          stats = {
            totalCampaigns: campaigns?.length || 0,
            activeCampaigns: campaigns?.filter(c => c.status === 'active').length || 0,
            totalImpressions: campaigns?.reduce((sum, c) => sum + (c.impressions || 0), 0) || 0,
            totalClicks: campaigns?.reduce((sum, c) => sum + (c.clicks || 0), 0) || 0,
            totalConversions: campaigns?.reduce((sum, c) => sum + (c.conversions || 0), 0) || 0,
            totalSpent: campaigns?.reduce((sum, c) => sum + (c.spent || 0), 0) || 0,
            totalBudget: campaigns?.reduce((sum, c) => sum + (c.budget || 0), 0) || 0,
            avgCTR: campaigns?.length ? 
              (campaigns.reduce((sum, c) => sum + (c.ctr || 0), 0) / campaigns.length) : 0
          }
        } else if (profile.role === 'publisher') {
          const { data: publisher } = await supabase
            .from('publishers')
            .select('*')
            .eq('user_id', userId)
            .single()

          stats = {
            totalImpressions: publisher?.total_impressions || 0,
            totalClicks: publisher?.total_clicks || 0,
            totalEarnings: publisher?.total_earnings || 0,
            ctr: publisher?.total_impressions > 0 ? 
              (publisher.total_clicks / publisher.total_impressions) * 100 : 0
          }
        } else if (profile.role === 'user') {
          const { data: rewards } = await supabase
            .from('user_rewards')
            .select('amount, status')
            .eq('user_id', userId)

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('token_balance')
            .eq('id', userId)
            .single()

          stats = {
            totalEarned: rewards?.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0) || 0,
            pendingRewards: rewards?.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0) || 0,
            tokenBalance: userProfile?.token_balance || 0,
            totalRewards: rewards?.length || 0
          }
        }

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'campaign': {
        if (!campaignId) {
          return new Response(
            JSON.stringify({ error: 'Campaign ID required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { data: campaign } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single()

        if (!campaign) {
          return new Response(
            JSON.stringify({ error: 'Campaign not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        // Get events for the campaign
        const { data: events } = await supabase
          .from('events')
          .select('type, timestamp, reward_amount')
          .eq('campaign_id', campaignId)
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
          .order('timestamp', { ascending: true })

        // Group events by day
        const dailyStats: Record<string, any> = {}
        events?.forEach(event => {
          const day = event.timestamp.split('T')[0]
          if (!dailyStats[day]) {
            dailyStats[day] = { impressions: 0, clicks: 0, conversions: 0, spend: 0 }
          }
          if (event.type === 'impression') dailyStats[day].impressions++
          if (event.type === 'click') dailyStats[day].clicks++
          if (event.type === 'conversion') dailyStats[day].conversions++
          dailyStats[day].spend += event.reward_amount || 0
        })

        return new Response(
          JSON.stringify({
            campaign,
            dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({ date, ...stats })),
            totals: {
              impressions: campaign.impressions,
              clicks: campaign.clicks,
              conversions: campaign.conversions,
              spent: campaign.spent,
              ctr: campaign.ctr
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'publisher': {
        if (!publisherId) {
          return new Response(
            JSON.stringify({ error: 'Publisher ID required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { data: publisher } = await supabase
          .from('publishers')
          .select('*')
          .eq('id', publisherId)
          .single()

        if (!publisher) {
          return new Response(
            JSON.stringify({ error: 'Publisher not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        // Get events for the publisher
        const { data: events } = await supabase
          .from('events')
          .select('type, timestamp, reward_amount')
          .eq('publisher_id', publisherId)
          .gte('timestamp', startDate)
          .lte('timestamp', endDate)
          .order('timestamp', { ascending: true })

        // Group events by day
        const dailyStats: Record<string, any> = {}
        events?.forEach(event => {
          const day = event.timestamp.split('T')[0]
          if (!dailyStats[day]) {
            dailyStats[day] = { impressions: 0, clicks: 0, earnings: 0 }
          }
          if (event.type === 'impression') dailyStats[day].impressions++
          if (event.type === 'click') dailyStats[day].clicks++
          dailyStats[day].earnings += (event.reward_amount || 0) * 0.2 // Publisher gets 20%
        })

        return new Response(
          JSON.stringify({
            publisher,
            dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({ date, ...stats })),
            totals: {
              impressions: publisher.total_impressions,
              clicks: publisher.total_clicks,
              earnings: publisher.total_earnings
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'platform': {
        // Platform-wide analytics (admin only)
        const [
          { count: totalUsers },
          { count: totalCampaigns },
          { count: totalPublishers },
          { data: campaigns },
          { data: events },
          { data: transactions }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('campaigns').select('*', { count: 'exact', head: true }),
          supabase.from('publishers').select('*', { count: 'exact', head: true }),
          supabase.from('campaigns').select('impressions, clicks, conversions, spent, budget'),
          supabase.from('events').select('type').gte('timestamp', startDate).lte('timestamp', endDate),
          supabase.from('transactions').select('amount, status').eq('status', 'completed')
        ])

        const totalImpressions = events?.filter(e => e.type === 'impression').length || 0
        const totalClicks = events?.filter(e => e.type === 'click').length || 0
        const totalConversions = events?.filter(e => e.type === 'conversion').length || 0

        return new Response(
          JSON.stringify({
            users: {
              total: totalUsers || 0
            },
            campaigns: {
              total: totalCampaigns || 0,
              totalBudget: campaigns?.reduce((sum, c) => sum + (c.budget || 0), 0) || 0,
              totalSpent: campaigns?.reduce((sum, c) => sum + (c.spent || 0), 0) || 0
            },
            publishers: {
              total: totalPublishers || 0
            },
            events: {
              impressions: totalImpressions,
              clicks: totalClicks,
              conversions: totalConversions,
              ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
            },
            revenue: {
              total: transactions?.reduce((sum, t) => sum + t.amount, 0) || 0,
              platformFee: (transactions?.reduce((sum, t) => sum + t.amount, 0) || 0) * 0.1 // 10% platform fee
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }

  } catch (error) {
    console.error('Analytics error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
