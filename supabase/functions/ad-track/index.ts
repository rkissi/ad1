import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get tracking parameters from URL or body
    const url = new URL(req.url)
    let type = url.searchParams.get('type')
    let adId = url.searchParams.get('adId')
    let campaignId = url.searchParams.get('campaignId')
    let publisherId = url.searchParams.get('publisherId')
    let slotId = url.searchParams.get('slotId')
    let userId = url.searchParams.get('userId')

    // Also support POST body
    if (req.method === 'POST') {
      const body = await req.json()
      type = type || body.type
      adId = adId || body.adId
      campaignId = campaignId || body.campaignId
      publisherId = publisherId || body.publisherId
      slotId = slotId || body.slotId
      userId = userId || body.userId
    }

    if (!type || !campaignId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Basic bot detection
    const userAgent = req.headers.get('user-agent') || ''
    const botPatterns = [/bot/i, /crawler/i, /spider/i, /headless/i, /externalhit/i]
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      return new Response(
        JSON.stringify({ error: 'Bot traffic detected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Idempotency check
    if (adId) {
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('ad_id', adId)
        .eq('type', type)
        .maybeSingle()

      if (existingEvent) {
        return new Response(
          JSON.stringify({ success: true, eventId: existingEvent.id, message: 'Duplicate event ignored' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // Validate event type
    const validTypes = ['impression', 'click', 'conversion']
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid event type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Rate limiting
    const sessionId = url.searchParams.get('sessionId') || adId || 'unknown'
    const { data: sessionData } = await supabase
      .from('fraud_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()

    const now = new Date()
    if (sessionData) {
      const lastEventAt = new Date(sessionData.last_event_at)
      const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000)
      const oneMinAgo = new Date(now.getTime() - 1 * 60 * 1000)

      if (type === 'click' && sessionData.click_count >= 10 && lastEventAt > fiveMinsAgo) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
      }
      if (type === 'impression' && sessionData.impression_count >= 50 && lastEventAt > oneMinAgo) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
      }

      await supabase.from('fraud_sessions').update({
        click_count: type === 'click' ? sessionData.click_count + 1 : sessionData.click_count,
        impression_count: type === 'impression' ? sessionData.impression_count + 1 : sessionData.impression_count,
        last_event_at: now.toISOString()
      }).eq('session_id', sessionId)
    } else {
      // Use adId as fallback session if not provided, for simplicity in MVP
      const { error: sessionError } = await supabase.from('fraud_sessions').insert({
        session_id: sessionId,
        user_id: userId || null,
        click_count: type === 'click' ? 1 : 0,
        impression_count: type === 'impression' ? 1 : 0,
        last_event_at: now.toISOString()
      })
      if (sessionError) console.error('Error creating fraud session:', sessionError)
    }

    // Get campaign to check budget and payout rules
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if campaign has budget remaining
    if (campaign.spent >= campaign.budget) {
      return new Response(
        JSON.stringify({ error: 'Campaign budget exhausted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Calculate reward based on event type
    const payoutRules = campaign.payout_rules || {
      impressionPayout: 0.001,
      clickPayout: 0.05,
      conversionPayout: 2.00
    }

    let rewardAmount = 0
    switch (type) {
      case 'impression':
        rewardAmount = payoutRules.impressionPayout || 0.001
        break
      case 'click':
        rewardAmount = payoutRules.clickPayout || 0.05
        break
      case 'conversion':
        rewardAmount = payoutRules.conversionPayout || 2.00
        break
    }

    // Record the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        type: type as any,
        ad_id: adId,
        campaign_id: campaignId,
        publisher_id: publisherId,
        user_id: userId || null,
        slot_id: slotId,
        reward_amount: rewardAmount,
        metadata: {
          userAgent: req.headers.get('user-agent'),
          referer: req.headers.get('referer'),
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (eventError) {
      console.error('Event insert error:', eventError)
      return new Response(
        JSON.stringify({ error: 'Failed to record event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Update campaign spent amount
    const newSpent = (campaign.spent || 0) + rewardAmount
    await supabase
      .from('campaigns')
      .update({ spent: newSpent })
      .eq('id', campaignId)

    // Create user reward if user is identified
    if (userId) {
      const userRewardAmount = rewardAmount * 0.7 // 70% to user
      await supabase.from('user_rewards').insert({
        user_id: userId,
        event_id: event.id,
        campaign_id: campaignId,
        amount: userRewardAmount,
        reward_type: type,
        status: 'pending'
      })

      // Update user token balance
      await supabase.rpc('increment_token_balance', {
        user_id: userId,
        amount: userRewardAmount
      }).catch(() => {
        // If RPC doesn't exist, update directly
        supabase
          .from('profiles')
          .select('token_balance')
          .eq('id', userId)
          .single()
          .then(({ data }) => {
            if (data) {
              supabase
                .from('profiles')
                .update({ token_balance: (data.token_balance || 0) + userRewardAmount })
                .eq('id', userId)
            }
          })
      })
    }

    // Update publisher earnings if publisher is identified
    if (publisherId) {
      const publisherRewardAmount = rewardAmount * 0.2 // 20% to publisher
      await supabase
        .from('publishers')
        .select('total_earnings')
        .eq('id', publisherId)
        .single()
        .then(({ data }) => {
          if (data) {
            supabase
              .from('publishers')
              .update({ total_earnings: (data.total_earnings || 0) + publisherRewardAmount })
              .eq('id', publisherId)
          }
        })
    }

    // Return 1x1 transparent pixel for impression tracking
    if (type === 'impression' && req.method === 'GET') {
      const pixel = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
        0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
        0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
        0x01, 0x00, 0x3b
      ])
      return new Response(pixel, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventId: event.id,
        rewardAmount,
        message: `${type} tracked successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Ad track error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
