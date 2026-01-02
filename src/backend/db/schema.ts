import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

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
