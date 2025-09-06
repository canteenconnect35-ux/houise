import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { gameId, userId, ticketPrice } = await req.json()

    // Generate tambola ticket with exactly 15 numbers
    const numbers = generateTambolaTicket()

    // Start transaction
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet')
      .eq('id', userId)
      .single()

    if (userError || user.wallet < ticketPrice) {
      throw new Error('Insufficient wallet balance')
    }

    // Check game availability
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || game.total_tickets >= game.max_tickets) {
      throw new Error('Game full or not available')
    }

    // Create ticket
    const { error: ticketError } = await supabase
      .from('tickets')
      .insert({
        game_id: gameId,
        user_id: userId,
        numbers: numbers,
        claimed_prizes: {}
      })

    if (ticketError) throw ticketError

    // Update user wallet using safe function
    const { data: walletResult, error: walletError } = await supabase
      .rpc('decrement_wallet', {
        user_id: userId,
        amount_to_subtract: ticketPrice
      })

    if (walletError || !walletResult) {
      throw new Error('Failed to deduct wallet balance')
    }

    // Update game stats
    const newTotal = game.total_tickets + 1
    const newCollection = game.total_collection + ticketPrice
    const adminCommission = newCollection * 0.20
    const prizePool = newCollection - adminCommission

    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({
        total_tickets: newTotal,
        total_collection: newCollection,
        admin_commission: adminCommission,
        prize_pool: prizePool
      })
      .eq('id', gameId)

    if (gameUpdateError) throw gameUpdateError

    // Add transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: ticketPrice,
        reason: 'Ticket purchase',
        game_id: gameId
      })

    return new Response(JSON.stringify({ success: true, numbers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateTambolaTicket(): number[] {
  // Generate exactly 15 unique numbers between 1-90
  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  const selectedNumbers: number[] = [];
  
  // Shuffle the array using Fisher-Yates algorithm
  for (let i = allNumbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allNumbers[i], allNumbers[j]] = [allNumbers[j], allNumbers[i]];
  }
  
  // Take the first 15 numbers
  selectedNumbers.push(...allNumbers.slice(0, 15));
  
  // Sort the numbers for better readability
  selectedNumbers.sort((a, b) => a - b);
  
  // Verify we have exactly 15 unique numbers
  if (selectedNumbers.length !== 15) {
    console.error('Generated ticket does not have exactly 15 numbers');
    throw new Error('Failed to generate valid ticket');
  }
  
  // Verify all numbers are unique
  const uniqueNumbers = new Set(selectedNumbers);
  if (uniqueNumbers.size !== 15) {
    console.error('Generated ticket has duplicate numbers');
    throw new Error('Failed to generate valid ticket');
  }
  
  console.log('Generated 15-digit ticket:', selectedNumbers);
  return selectedNumbers;
}