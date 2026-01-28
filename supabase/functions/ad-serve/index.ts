import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AdRequest {
  publisherId: string
  slotId: string
  userId?: string
  context?: {
    url?: string
    keywords?: string[]
    categories?: string[]
  }
}

interface AdResponse {
  adId: string
  campaignId: string
  creative: {
    type: string
    headline: string
    description: string
    imageUrl?: string
    ctaText: string
    ctaUrl: string
  }
  trackingUrls: {
    impression: string
    click: string
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

    const adRequest: AdRequest = await req.json()
    const { publisherId, slotId, userId, context } = adRequest

    // Validate publisher
    const { data: publisher, error: publisherError } = await supabase
      .from('publishers')
      .select('*')
      .eq('id', publisherId)
      .eq('status', 'active')
      .single()

    if (publisherError || !publisher) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive publisher' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get active campaigns with budget remaining
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        *,
        ad_creatives (*)
      `)
      .eq('status', 'active')
      .gt('budget', 0)
      .order('budget', { ascending: false })
      .limit(20)

    if (campaignsError || !campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No ads available', code: 'NO_ADS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 204 }
      )
    }

    // Simple matching algorithm - in production this would be ML-based
    let selectedCampaign = campaigns[0]
    let highestScore = 0

    for (const campaign of campaigns) {
      let score = 0
      const audienceSpec = campaign.audience_spec || {}

      // Score based on context matching
      if (context?.categories && audienceSpec.interests) {
        const matchingInterests = context.categories.filter(
          (cat: string) => audienceSpec.interests.includes(cat)
        )
        score += matchingInterests.length * 10
      }

      // Score based on budget (higher budget = higher priority)
      score += Math.min(campaign.budget / 1000, 10)

      // Score based on CTR performance
      if (campaign.impressions > 100) {
        score += (campaign.clicks / campaign.impressions) * 100
      }

      if (score > highestScore) {
        highestScore = score
        selectedCampaign = campaign
      }
    }

    // Get creative for the selected campaign
    const creative = selectedCampaign.ad_creatives?.[0] || {
      type: 'banner',
      content: {
        headline: selectedCampaign.name,
        description: selectedCampaign.description || 'Check out this offer!',
        ctaText: 'Learn More',
        ctaUrl: '#'
      }
    }

    // Generate unique ad ID for tracking
    const adId = crypto.randomUUID()

    // Build response
    const adResponse: AdResponse = {
      adId,
      campaignId: selectedCampaign.id,
      creative: {
        type: creative.type || 'banner',
        headline: creative.content?.headline || selectedCampaign.name,
        description: creative.content?.description || selectedCampaign.description || '',
        imageUrl: creative.image_url,
        ctaText: creative.cta_text || 'Learn More',
        ctaUrl: creative.cta_url || '#'
      },
      trackingUrls: {
        impression: `${supabaseUrl}/functions/v1/supabase-functions-ad-track?type=impression&adId=${adId}&campaignId=${selectedCampaign.id}&publisherId=${publisherId}&slotId=${slotId}`,
        click: `${supabaseUrl}/functions/v1/supabase-functions-ad-track?type=click&adId=${adId}&campaignId=${selectedCampaign.id}&publisherId=${publisherId}&slotId=${slotId}`
      }
    }

    // Record ad request for analytics
    await supabase.from('events').insert({
      type: 'view',
      ad_id: adId,
      campaign_id: selectedCampaign.id,
      publisher_id: publisherId,
      user_id: userId || null,
      slot_id: slotId,
      metadata: {
        context,
        matchScore: highestScore
      }
    })

    return new Response(
      JSON.stringify(adResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Ad serve error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
