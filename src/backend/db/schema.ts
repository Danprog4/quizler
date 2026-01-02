import { pgTable, pgView, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Quiz results table - stores individual quiz completions
// References auth.users from Supabase (no need to duplicate users table)
export const quizResults = pgTable("quiz_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(), // References auth.users(id) - FK set in Supabase
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: integer("percentage").notNull(),
  pageUrl: text("page_url"),
  pageTitle: text("page_title"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Types for TypeScript
export type QuizResult = typeof quizResults.$inferSelect;
export type NewQuizResult = typeof quizResults.$inferInsert;

// Leaderboard view - joins quiz_results with auth.users (Supabase system table)
// Note: This view references auth.users which is managed by Supabase, not Drizzle
// The actual view must be created via SQL migration since it crosses schema boundaries
export const leaderboard = pgView("leaderboard", {
  userId: uuid("user_id"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  username: text("username"),
  totalQuizzes: integer("total_quizzes"),
  totalScore: integer("total_score"),
  avgPercentage: integer("avg_percentage"),
}).as(
  sql`SELECT
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
  ORDER BY total_score DESC`
);

// Leaderboard types
export type LeaderboardEntry = typeof leaderboard.$inferSelect;
