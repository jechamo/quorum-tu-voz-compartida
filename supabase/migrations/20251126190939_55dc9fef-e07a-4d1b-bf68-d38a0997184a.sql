-- Create filtered stats function
CREATE OR REPLACE FUNCTION get_question_stats_filtered(
  question_uuid uuid,
  filter_party_id uuid DEFAULT NULL,
  filter_team_id uuid DEFAULT NULL,
  filter_gender user_gender DEFAULT NULL,
  filter_age_min integer DEFAULT NULL,
  filter_age_max integer DEFAULT NULL
)
RETURNS TABLE (
  option_id uuid,
  option_text text,
  option_order integer,
  vote_count bigint,
  total_votes bigint,
  percentage integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_answers AS (
    SELECT ua.id, ua.answer_option_id
    FROM user_answers ua
    INNER JOIN profiles p ON p.id = ua.user_id
    WHERE ua.question_id = question_uuid
      AND (filter_party_id IS NULL OR p.party_id = filter_party_id)
      AND (filter_team_id IS NULL OR p.team_id = filter_team_id)
      AND (filter_gender IS NULL OR p.gender = filter_gender)
      AND (filter_age_min IS NULL OR p.age >= filter_age_min)
      AND (filter_age_max IS NULL OR p.age <= filter_age_max)
  ),
  vote_counts AS (
    SELECT 
      ao.id,
      ao.text,
      ao.option_order,
      COUNT(fa.id) as votes
    FROM answer_options ao
    LEFT JOIN filtered_answers fa ON fa.answer_option_id = ao.id
    WHERE ao.question_id = question_uuid
    GROUP BY ao.id, ao.text, ao.option_order
  ),
  total AS (
    SELECT COALESCE(SUM(votes), 0) as total_votes FROM vote_counts
  )
  SELECT 
    vc.id as option_id,
    vc.text as option_text,
    vc.option_order,
    vc.votes as vote_count,
    t.total_votes,
    CASE 
      WHEN t.total_votes > 0 THEN ROUND((vc.votes::numeric / t.total_votes) * 100)::integer
      ELSE 0
    END as percentage
  FROM vote_counts vc, total t
  ORDER BY vc.option_order;
$$;

-- Create phone verifications table
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for sending verification)
CREATE POLICY "Anyone can request verification"
ON public.phone_verifications
FOR INSERT
WITH CHECK (true);

-- Allow reading own verification
CREATE POLICY "Can read own verification by phone"
ON public.phone_verifications
FOR SELECT
USING (true);

-- Allow updating own verification (for marking as verified)
CREATE POLICY "Can verify own code"
ON public.phone_verifications
FOR UPDATE
USING (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON public.phone_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires_at ON public.phone_verifications(expires_at);