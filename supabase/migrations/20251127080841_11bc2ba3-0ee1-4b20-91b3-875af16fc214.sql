-- First, drop the existing foreign key constraint
ALTER TABLE public.question_comments 
DROP CONSTRAINT IF EXISTS question_comments_user_id_fkey;

-- Add foreign key to profiles instead of auth.users
ALTER TABLE public.question_comments
ADD CONSTRAINT question_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;