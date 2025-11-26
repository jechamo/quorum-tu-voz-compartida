-- Add foreign key constraint between user_roles and profiles
-- This will allow the AdminsManagement component to properly join and display admin users

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;