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

    const { ticketId, gameId, prizeType, drawnNumbers } = await req.json()

    // Get ticket and game data
    const [ticketRes, gameRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('games').select('*').eq('id', gameId).single()
    ])

    if (ticketRes.error || gameRes.error) {
      throw new Error('Invalid ticket or game')
    }

    const ticket = ticketRes.data
    const game = gameRes.data

    // Check if already claimed
    if (ticket.claimed_prizes?.[prizeType]) {
      throw new Error('Prize already claimed')
    }

    // Ensure ticket numbers is a flat array of 15 numbers
    let ticketNumbers = ticket.numbers;
    if (Array.isArray(ticketNumbers) && Array.isArray(ticketNumbers[0])) {
      ticketNumbers = ticketNumbers.flat();
    }
    
    if (!Array.isArray(ticketNumbers) || ticketNumbers.length !== 15) {
      throw new Error('Invalid ticket format')
    }

    // Validate prize claim
    const isValid = validatePrizeClaim(ticketNumbers, drawnNumbers, prizeType)
    
    if (!isValid) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid prize claim' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate prize amount
    const amount = calculatePrizeAmount(game.prize_pool, prizeType)

    // Update ticket
    const updatedPrizes = { ...ticket.claimed_prizes, [prizeType]: true }
    await supabase
      .from('tickets')
      .update({ claimed_prizes: updatedPrizes })
      .eq('id', ticketId)

    // Credit user wallet using safe function
    const { data: walletResult, error: walletError } = await supabase
      .rpc('increment_wallet', {
        user_id: ticket.user_id,
        amount_to_add: amount
      })

    if (walletError || !walletResult) {
      throw new Error('Failed to credit wallet balance')
    }

    // Add transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: ticket.user_id,
        type: 'credit',
        amount: amount,
        reason: `Prize: ${prizeType}`,
        game_id: gameId
      })

    return new Response(JSON.stringify({ success: true, amount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function validatePrizeClaim(ticketNumbers: number[], drawnNumbers: number[], prizeType: string): boolean {
  // Filter out zero/empty numbers and find matches
  const validTicketNumbers = ticketNumbers.filter(num => num > 0);
  const matchedNumbers = validTicketNumbers.filter(num => drawnNumbers.includes(num));
  
  console.log(`Validating ${prizeType}: ${matchedNumbers.length} matches out of ${validTicketNumbers.length} valid numbers`);
  
  switch (prizeType) {
    case 'early_five':
      // Early five: first 5 numbers to be struck off
      return matchedNumbers.length >= 5;
      
    case 'top_line':
      // Top line: first 5 numbers of the ticket (positions 0-4)
      const topLineNumbers = ticketNumbers.slice(0, 5).filter(num => num > 0);
      const topLineMatches = topLineNumbers.filter(num => drawnNumbers.includes(num));
      return topLineMatches.length === topLineNumbers.length && topLineNumbers.length > 0;
      
    case 'middle_line':
      // Middle line: middle 5 numbers of the ticket (positions 5-9)
      const middleLineNumbers = ticketNumbers.slice(5, 10).filter(num => num > 0);
      const middleLineMatches = middleLineNumbers.filter(num => drawnNumbers.includes(num));
      return middleLineMatches.length === middleLineNumbers.length && middleLineNumbers.length > 0;
      
    case 'bottom_line':
      // Bottom line: last 5 numbers of the ticket (positions 10-14)
      const bottomLineNumbers = ticketNumbers.slice(10, 15).filter(num => num > 0);
      const bottomLineMatches = bottomLineNumbers.filter(num => drawnNumbers.includes(num));
      return bottomLineMatches.length === bottomLineNumbers.length && bottomLineNumbers.length > 0;
      
    case 'full_house':
      // Full house: all numbers on the ticket
      return matchedNumbers.length === validTicketNumbers.length && validTicketNumbers.length === 15;
      
    default:
      return false;
  }
}

function calculatePrizeAmount(prizePool: number, prizeType: string): number {
  switch (prizeType) {
    case 'early_five': return Math.floor(prizePool * 0.20);
    case 'top_line': return Math.floor(prizePool * 0.15);
    case 'middle_line': return Math.floor(prizePool * 0.15);
    case 'bottom_line': return Math.floor(prizePool * 0.15);
    case 'full_house': return Math.floor(prizePool * 0.35);
    default: return 0;
  }
}