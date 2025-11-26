-- Fix search path for create_initial_admin function
CREATE OR REPLACE FUNCTION public.create_initial_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Check if admin creation marker exists
  SELECT EXISTS (
    SELECT 1 FROM public.system_config WHERE key = 'admin_created'
  ) INTO admin_exists;
  
  IF NOT admin_exists THEN
    -- Insert marker to prevent duplicate creation
    INSERT INTO public.system_config (key, value)
    VALUES ('admin_created', 'pending');
  END IF;
END;
$$;
