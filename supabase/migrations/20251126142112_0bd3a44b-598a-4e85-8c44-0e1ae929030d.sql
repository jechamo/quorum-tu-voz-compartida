-- Allow users to insert their own 'user' role during signup
-- This is needed for the signup process to work
CREATE POLICY "Users can insert own user role during signup"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND role = 'user'
);