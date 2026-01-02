-- Create leaderboard view that joins quiz_results with auth.users
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  qr.user_id,
  u.email,
  u.raw_user_meta_data->>'avatar_url' as avatar_url,
  COALESCE(u.raw_user_meta_data->>'user_name', u.raw_user_meta_data->>'preferred_username') as username,
  COUNT(*)::integer as total_quizzes,
  SUM(qr.score)::integer as total_score,
  ROUND(AVG(qr.percentage))::integer as avg_percentage
FROM public.quiz_results qr
JOIN auth.users u ON qr.user_id = u.id
GROUP BY qr.user_id, u.email, u.raw_user_meta_data
ORDER BY total_score DESC;

-- Grant access to the view
GRANT SELECT ON public.leaderboard TO anon, authenticated;
