import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OnboardingRequest {
  action: 'start' | 'step' | 'complete' | 'status'
  step?: string
  data?: Record<string, any>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get auth header from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Create supabase client with user's token for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // Verify user
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Use service role client for database operations to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const userId = user.id
    const request: OnboardingRequest = await req.json()
    const { action, step, data } = request

    // Get user's profile to know their role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, onboarding_status, onboarding_step')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    switch (action) {
      case 'status': {
        return new Response(
          JSON.stringify(profile),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'start': {
        // If already completed, just return
        if (profile.onboarding_status === 'completed') {
          return new Response(
            JSON.stringify({ message: 'Onboarding already completed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }

        // Set status to in_progress
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ onboarding_status: 'in_progress' })
          .eq('id', userId)

        if (updateError) {
          console.error('Start onboarding error:', updateError)
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ success: true, status: 'in_progress' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'step': {
        if (!step) {
          return new Response(
            JSON.stringify({ error: 'Step is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const role = profile.role

        // Update role-specific table if data provided
        if (data && Object.keys(data).length > 0) {
          let table = ''
          if (role === 'user') table = 'user_onboarding'
          else if (role === 'advertiser') table = 'advertiser_onboarding'
          else if (role === 'publisher') table = 'publisher_onboarding'

          if (table) {
            // Prepare data with proper ID column
            const updateData = { ...data }
            if (role === 'user') updateData.user_id = userId
            else if (role === 'advertiser') updateData.advertiser_id = userId
            else if (role === 'publisher') updateData.publisher_id = userId

            const { error: tableError } = await supabase
              .from(table)
              .upsert(updateData)

            if (tableError) {
              console.error('Table upsert error:', tableError)
              return new Response(
                JSON.stringify({ error: tableError.message }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              )
            }
          }
        }

        // Update profile step and status
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            onboarding_step: step,
            onboarding_status: 'in_progress'
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Update step error:', updateError)
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ success: true, step }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'complete': {
        const { error } = await supabase
          .from('profiles')
          .update({
            onboarding_status: 'completed',
            onboarding_completed_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (error) {
          console.error('Complete onboarding error:', error)
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        return new Response(
          JSON.stringify({ success: true, status: 'completed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Onboarding function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
