import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "./ai";

const MAX_TEXT_LENGTH = 9000;
const quizItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
});
const quizSchema = z.object({
  questions: z.array(quizItemSchema).min(1),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });

const stripHtml = (html: string) => {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " "
  );
  return withoutStyles
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const fetchPageText = async (url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    const html = await response.text();
    return stripHtml(html).slice(0, MAX_TEXT_LENGTH);
  } catch {
    return "";
  }
};

Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  fetch: async (req) => {
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (pathname === "/api/quiz" && req.method === "POST") {
      const payload = await req.json().catch(() => null);

      if (!payload || typeof payload.url !== "string") {
        return jsonResponse({ error: "Missing url" }, { status: 400 });
      }

      const text =
        typeof payload.text === "string" && payload.text.trim().length > 0
          ? payload.text.slice(0, MAX_TEXT_LENGTH)
          : await fetchPageText(payload.url);

      if (!text) {
        return jsonResponse(
          { error: "Unable to extract page text" },
          { status: 400 }
        );
      }

      const requestedCount = Number(payload.count ?? 5);
      const questionCount =
        Number.isFinite(requestedCount) && requestedCount > 0
          ? Math.min(Math.floor(requestedCount), 10)
          : 5;

      const prompt = `You are Quizler. Create ${questionCount} multiple-choice questions based on the content below.
Return an array of questions, each with 4 options and a correctIndex (0-3). Keep questions specific to the page.

Title: ${payload.title ?? "Unknown"}
URL: ${payload.url}

Content:
${text}`;

      const result = await generateObject({
        model: openrouter("google/gemini-3-flash-preview"),
        schema: quizSchema,
        prompt,
        temperature: 0.4,
      });

      return jsonResponse({
        ...result.object,
        sourceUrl: payload.url,
      });
    }

    if (pathname === "/health") {
      return jsonResponse({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },
});
