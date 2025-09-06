-- Create function to safely increment wallet balance
CREATE OR REPLACE FUNCTION public.increment_wallet(user_id uuid, amount_to_add numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.users 
    SET wallet = wallet + amount_to_add 
    WHERE id = user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Create function to safely decrement wallet balance
CREATE OR REPLACE FUNCTION public.decrement_wallet(user_id uuid, amount_to_subtract numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance DECIMAL(10,2);
BEGIN
    -- Get current balance
    SELECT wallet INTO current_balance FROM public.users WHERE id = user_id;
    
    IF current_balance IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if sufficient balance
    IF current_balance < amount_to_subtract THEN
        RETURN FALSE;
    END IF;
    
    -- Update wallet balance
    UPDATE public.users 
    SET wallet = wallet - amount_to_subtract 
    WHERE id = user_id;
    
    RETURN TRUE;
END;
$$;