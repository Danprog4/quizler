import { jsonResponse } from "../lib/http";
import { generateQuiz } from "../services/quiz.service";

export async function handleQuiz(req: Request): Promise<Response> {
  const payload = await req.json().catch(() => null);

  if (!payload || typeof payload.url !== "string") {
    return jsonResponse({ error: "Missing url" }, { status: 400 });
  }

  const result = await generateQuiz({
    url: payload.url,
    title: payload.title,
    text: payload.text,
    count: payload.count,
  });

  if ("error" in result) {
    return jsonResponse({ error: result.error }, { status: 400 });
  }

  return jsonResponse(result);
}
