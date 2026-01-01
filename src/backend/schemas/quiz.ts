import { z } from "zod";

export const quizItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

export const quizSchema = z.object({
  questions: z.array(quizItemSchema).min(1),
});

export type QuizItem = z.infer<typeof quizItemSchema>;
export type Quiz = z.infer<typeof quizSchema>;
