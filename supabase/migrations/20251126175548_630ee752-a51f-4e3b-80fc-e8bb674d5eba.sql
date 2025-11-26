-- Create function to get question statistics securely
CREATE OR REPLACE FUNCTION get_question_stats(question_uuid uuid)
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
  WITH vote_counts AS (
    SELECT 
      ao.id,
      ao.text,
      ao.option_order,
      COUNT(ua.id) as votes
    FROM answer_options ao
    LEFT JOIN user_answers ua ON ua.answer_option_id = ao.id
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