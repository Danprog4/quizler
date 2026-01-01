import { generateObject } from "ai";
import { openrouter } from "../lib/ai";
import { quizSchema } from "../schemas/quiz";
import { fetchPageText } from "../utils/html";

const MAX_TEXT_LENGTH = 9000;

interface GenerateQuizParams {
  url: string;
  title?: string;
  text?: string;
  count?: number;
}

export async function generateQuiz({ url, title, text, count }: GenerateQuizParams) {
  const pageText =
    typeof text === "string" && text.trim().length > 0
      ? text.slice(0, MAX_TEXT_LENGTH)
      : await fetchPageText(url);

  if (!pageText) {
    return { error: "Unable to extract page text" };
  }

  const requestedCount = Number(count ?? 5);
  const questionCount =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(Math.floor(requestedCount), 10)
      : 5;

  const prompt = `You are Quizler. Create ${questionCount} multiple-choice questions based on the content below.
Return an array of questions, each with 4 options and a correctIndex (0-3). Keep questions specific to the page.

Title: ${title ?? "Unknown"}
URL: ${url}

Content:
${pageText}`;

  const result = await generateObject({
    model: openrouter("google/gemini-3-flash-preview"),
    schema: quizSchema,
    prompt,
    temperature: 0.4,
  });

  return {
    ...result.object,
    sourceUrl: url,
  };
}
