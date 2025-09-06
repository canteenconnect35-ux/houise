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

    // Generate tambola ticket with proper 3x9 format
    const ticketGrid = generateTambolaTicket()

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
        numbers: ticketGrid,
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

    return new Response(JSON.stringify({ success: true, numbers: ticketGrid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateTambolaTicket(): number[][] {
  // Create 3x9 grid initialized with zeros
  const grid: number[][] = Array(3).fill(null).map(() => Array(9).fill(0));
  
  // Column ranges: 0-9, 10-19, 20-29, ..., 80-89
  const columnRanges = [
    [1, 9],   // Column 0: 1-9 (we avoid 0 for better gameplay)
    [10, 19], // Column 1: 10-19
    [20, 29], // Column 2: 20-29
    [30, 39], // Column 3: 30-39
    [40, 49], // Column 4: 40-49
    [50, 59], // Column 5: 50-59
    [60, 69], // Column 6: 60-69
    [70, 79], // Column 7: 70-79
    [80, 90]  // Column 8: 80-90
  ];
  
  // For each row, select exactly 5 columns to have numbers
  for (let row = 0; row < 3; row++) {
    // Randomly select 5 columns out of 9 for this row
    const availableColumns = Array.from({ length: 9 }, (_, i) => i);
    const selectedColumns: number[] = [];
    
    // Fisher-Yates shuffle to select 5 random columns
    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * availableColumns.length);
      selectedColumns.push(availableColumns.splice(randomIndex, 1)[0]);
    }
    
    // Sort selected columns for better visual arrangement
    selectedColumns.sort((a, b) => a - b);
    
    // Assign numbers to selected columns
    for (const col of selectedColumns) {
      const [min, max] = columnRanges[col];
      let number: number;
      
      // Generate unique number for this column across all rows
      do {
        number = Math.floor(Math.random() * (max - min + 1)) + min;
      } while (isNumberUsedInColumn(grid, col, number));
      
      grid[row][col] = number;
    }
  }
  
  // Sort numbers within each column (top to bottom)
  for (let col = 0; col < 9; col++) {
    const columnNumbers = [];
    for (let row = 0; row < 3; row++) {
      if (grid[row][col] !== 0) {
        columnNumbers.push(grid[row][col]);
      }
    }
    
    if (columnNumbers.length > 1) {
      columnNumbers.sort((a, b) => a - b);
      let numberIndex = 0;
      for (let row = 0; row < 3; row++) {
        if (grid[row][col] !== 0) {
          grid[row][col] = columnNumbers[numberIndex++];
        }
      }
    }
  }
  
  // Verify the ticket has exactly 15 numbers
  const totalNumbers = grid.flat().filter(num => num !== 0).length;
  if (totalNumbers !== 15) {
    console.error(`Generated ticket has ${totalNumbers} numbers instead of 15`);
    throw new Error('Failed to generate valid ticket');
  }
  
  // Verify each row has exactly 5 numbers
  for (let row = 0; row < 3; row++) {
    const rowNumbers = grid[row].filter(num => num !== 0).length;
    if (rowNumbers !== 5) {
      console.error(`Row ${row} has ${rowNumbers} numbers instead of 5`);
      throw new Error('Failed to generate valid ticket');
    }
  }
  
  console.log('Generated proper Tambola ticket:', grid);
  return grid;
}

function isNumberUsedInColumn(grid: number[][], col: number, number: number): boolean {
  for (let row = 0; row < 3; row++) {
    if (grid[row][col] === number) {
      return true;
    }
  }
  return false;
}