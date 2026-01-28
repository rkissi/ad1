import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PayoutRequest {
  action: 'request' | 'process' | 'status' | 'history'
  userId: string
  amount?: number
  payoutMethod?: 'token' | 'voucher' | 'crypto'
  walletAddress?: string
  payoutId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const request: PayoutRequest = await req.json()
    const { action, userId, amount, payoutMethod, walletAddress, payoutId } = request

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    switch (action) {
      case 'request': {
        if (!amount || amount <= 0) {
          return new Response(
            JSON.stringify({ error: 'Valid amount is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Check if user has sufficient balance
        const tokenBalance = profile.token_balance || 0
        if (amount > tokenBalance) {
          return new Response(
            JSON.stringify({ 
              error: 'Insufficient balance',
              available: tokenBalance,
              requested: amount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Get platform settings for minimum payout
        const { data: settings } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'min_payout_amount')
          .single()

        const minPayout = settings?.value?.value || 10
        if (amount < minPayout) {
          return new Response(
            JSON.stringify({ 
              error: `Minimum payout amount is $${minPayout}`,
              minimum: minPayout,
              requested: amount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // Create payout transaction
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            type: 'payout',
            from_user_id: null, // Platform
            to_user_id: userId,
            amount,
            currency: 'USD',
            status: 'pending',
            metadata: {
              payoutMethod: payoutMethod || 'token',
              walletAddress: walletAddress || profile.wallet_address,
              requestedAt: new Date().toISOString()
            }
          })
          .select()
          .single()

        if (txError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create payout request' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Deduct from user balance (hold)
        await supabase
          .from('profiles')
          .update({ token_balance: tokenBalance - amount })
          .eq('id', userId)

        return new Response(
          JSON.stringify({ 
            success: true,
            transaction,
            message: 'Payout request submitted successfully',
            estimatedProcessingTime: '1-3 business days'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'process': {
        // This would typically be called by an admin or automated system
        if (!payoutId) {
          return new Response(
            JSON.stringify({ error: 'Payout ID is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', payoutId)
          .eq('type', 'payout')
          .single()

        if (txError || !transaction) {
          return new Response(
            JSON.stringify({ error: 'Payout not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        if (transaction.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Payout already processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        // In production, this would integrate with payment providers
        // For now, we'll simulate processing
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: 'completed',
            metadata: {
              ...transaction.metadata,
              processedAt: new Date().toISOString(),
              // In production: blockchain_tx_hash, stripe_transfer_id, etc.
            }
          })
          .eq('id', payoutId)

        if (updateError) {
          return new Response(
            JSON.stringify({ error: 'Failed to process payout' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        // Update related user rewards to completed
        await supabase
          .from('user_rewards')
          .update({ status: 'completed', paid_at: new Date().toISOString() })
          .eq('user_id', transaction.to_user_id)
          .eq('status', 'pending')

        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Payout processed successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'status': {
        if (!payoutId) {
          return new Response(
            JSON.stringify({ error: 'Payout ID is required' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }

        const { data: transaction, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', payoutId)
          .eq('to_user_id', userId)
          .single()

        if (error || !transaction) {
          return new Response(
            JSON.stringify({ error: 'Payout not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          )
        }

        return new Response(
          JSON.stringify({ transaction }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'history': {
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('to_user_id', userId)
          .eq('type', 'payout')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch payout history' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          )
        }

        const summary = {
          totalPayouts: transactions.length,
          totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
          pendingAmount: transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0),
          completedAmount: transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0)
        }

        return new Response(
          JSON.stringify({ transactions, summary }),
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
    console.error('Rewards payout error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
