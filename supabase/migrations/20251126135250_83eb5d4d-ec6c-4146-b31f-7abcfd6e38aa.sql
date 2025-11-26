-- Create admin user via edge function that will be called once
-- We'll insert a marker to prevent duplicate admin creation

CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view system config" ON public.system_config
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert system config" ON public.system_config
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to create initial admin user
CREATE OR REPLACE FUNCTION public.create_initial_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Execute the function to set up admin creation marker
SELECT public.create_initial_admin();
