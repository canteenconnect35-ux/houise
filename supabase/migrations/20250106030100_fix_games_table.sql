-- Ensure games table has all required columns
DO $$ 
BEGIN
    -- Add started_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'started_at') THEN
        ALTER TABLE public.games ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    
    -- Add completed_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'completed_at') THEN
        ALTER TABLE public.games ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
    
    -- Add game_data column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'games' AND column_name = 'game_data') THEN
        ALTER TABLE public.games ADD COLUMN game_data JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_games_start_time ON public.games(start_time);
CREATE INDEX IF NOT EXISTS idx_games_started_at ON public.games(started_at);

-- Update RLS policies to allow updates
DROP POLICY IF EXISTS "Users can view games" ON public.games;
DROP POLICY IF EXISTS "Admins can manage games" ON public.games;

CREATE POLICY "Users can view games" ON public.games
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage games" ON public.games
    FOR ALL USING (true);
