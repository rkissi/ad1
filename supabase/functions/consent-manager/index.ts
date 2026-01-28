import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConsentRequest {
  action: 'grant' | 'revoke' | 'check' | 'list'
  userId: string
  scope?: string
  campaignId?: string
  consentId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const request: ConsentRequest = await req.json()
    const { action, userId, scope, campaignId, consentId } = request

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    switch (action) {
      case 'grant': {
        if (!scope) {
          return new Response(
            JSON.stringify({ error: 'Scope is required for granting consent' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Check if consent already exists
        const { data: existing } = await supabase
          .from('consents')
          .select('*')
          .eq('user_id', userId)
          .eq('scope', scope)
          .eq('is_active', true)
          .maybeSingle()

        if (existing) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              consent: existing,
              message: 'Consent already granted'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }

        // Generate consent signature (in production, this would be cryptographic)
        const signature = `consent:${userId}:${scope}:${Date.now()}`
        const signatureHash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(signature)
        )
        const signatureHex = Array.from(new Uint8Array(signatureHash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')

        // Create consent record
        const { data: consent, error } = await supabase
          .from('consents')
          .insert({
            user_id: userId,
            scope,
            campaign_id: campaignId || null,
            signature: signatureHex,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to grant consent' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Update user profile consents
        const { data: profile } = await supabase
          .from('profiles')
          .select('consents')
          .eq('id', userId)
          .single()

        const currentConsents = profile?.consents || {}
        await supabase
          .from('profiles')
          .update({
            consents: {
              ...currentConsents,
              [scope]: true
            }
          })
          .eq('id', userId)

        return new Response(
          JSON.stringify({ 
            success: true, 
            consent,
            message: 'Consent granted successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'revoke': {
        if (!consentId && !scope) {
          return new Response(
            JSON.stringify({ error: 'Consent ID or scope is required for revoking' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        let query = supabase
          .from('consents')
          .update({ 
            is_active: false, 
            revoked_at: new Date().toISOString() 
          })
          .eq('user_id', userId)

        if (consentId) {
          query = query.eq('id', consentId)
        } else if (scope) {
          query = query.eq('scope', scope)
        }

        const { data: consent, error } = await query.select().single()

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to revoke consent' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Update user profile consents
        if (scope) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('consents')
            .eq('id', userId)
            .single()

          const currentConsents = profile?.consents || {}
          delete currentConsents[scope]
          await supabase
            .from('profiles')
            .update({ consents: currentConsents })
            .eq('id', userId)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            consent,
            message: 'Consent revoked successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'check': {
        if (!scope) {
          return new Response(
            JSON.stringify({ error: 'Scope is required for checking consent' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { data: consent } = await supabase
          .from('consents')
          .select('*')
          .eq('user_id', userId)
          .eq('scope', scope)
          .eq('is_active', true)
          .maybeSingle()

        return new Response(
          JSON.stringify({ 
            hasConsent: !!consent,
            consent
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'list': {
        const { data: consents, error } = await supabase
          .from('consents')
          .select('*')
          .eq('user_id', userId)
          .order('granted_at', { ascending: false })

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to list consents' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ 
            consents,
            activeCount: consents.filter(c => c.is_active).length,
            revokedCount: consents.filter(c => !c.is_active).length
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
    console.error('Consent manager error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
