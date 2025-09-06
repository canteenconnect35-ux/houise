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

    // Ensure ticket numbers is in proper 3x9 grid format
    let ticketGrid = ticket.numbers;
    if (!Array.isArray(ticketGrid) || ticketGrid.length !== 3) {
      throw new Error('Invalid ticket format - must be 3x9 grid')
    }
    
    // Verify each row has 9 columns
    for (let i = 0; i < 3; i++) {
      if (!Array.isArray(ticketGrid[i]) || ticketGrid[i].length !== 9) {
        throw new Error('Invalid ticket format - each row must have 9 columns')
      }
    }

    // Validate prize claim
    const isValid = validatePrizeClaim(ticketGrid, drawnNumbers, prizeType)
    
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

function validatePrizeClaim(ticketGrid: number[][], drawnNumbers: number[], prizeType: string): boolean {
  // Get all valid numbers from the ticket
  const allTicketNumbers = ticketGrid.flat().filter(num => num > 0);
  const matchedNumbers = allTicketNumbers.filter(num => drawnNumbers.includes(num));
  
  console.log(`Validating ${prizeType}: ${matchedNumbers.length} matches out of ${allTicketNumbers.length} valid numbers`);
  
  switch (prizeType) {
    case 'early_five':
      // Early five: first 5 numbers to be struck off
      return matchedNumbers.length >= 5;
      
    case 'top_line':
      // Top line: all numbers in row 0
      const topLineNumbers = ticketGrid[0].filter(num => num > 0);
      const topLineMatches = topLineNumbers.filter(num => drawnNumbers.includes(num));
      return topLineMatches.length === topLineNumbers.length && topLineNumbers.length === 5;
      
    case 'middle_line':
      // Middle line: all numbers in row 1
      const middleLineNumbers = ticketGrid[1].filter(num => num > 0);
      const middleLineMatches = middleLineNumbers.filter(num => drawnNumbers.includes(num));
      return middleLineMatches.length === middleLineNumbers.length && middleLineNumbers.length === 5;
      
    case 'bottom_line':
      // Bottom line: all numbers in row 2
      const bottomLineNumbers = ticketGrid[2].filter(num => num > 0);
      const bottomLineMatches = bottomLineNumbers.filter(num => drawnNumbers.includes(num));
      return bottomLineMatches.length === bottomLineNumbers.length && bottomLineNumbers.length === 5;
      
    case 'full_house':
      // Full house: all 15 numbers on the ticket
      return matchedNumbers.length === allTicketNumbers.length && allTicketNumbers.length === 15;
      
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