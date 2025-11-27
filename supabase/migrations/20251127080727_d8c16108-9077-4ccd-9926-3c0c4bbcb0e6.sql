-- Create comments table
CREATE TABLE IF NOT EXISTS public.question_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_not_empty CHECK (length(trim(comment)) > 0)
);

-- Enable RLS
ALTER TABLE public.question_comments ENABLE ROW LEVEL SECURITY;

-- Users can view all comments
CREATE POLICY "Users can view all comments"
ON public.question_comments
FOR SELECT
TO authenticated
USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert own comments"
ON public.question_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.question_comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.question_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
ON public.question_comments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_question_comments_question_id ON public.question_comments(question_id);
CREATE INDEX idx_question_comments_user_id ON public.question_comments(user_id);
CREATE INDEX idx_question_comments_created_at ON public.question_comments(created_at DESC);