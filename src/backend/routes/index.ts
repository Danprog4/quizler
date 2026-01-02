import { corsHeaders, jsonResponse } from "../lib/http";
import { handleHealth } from "./health";
import { handleQuiz } from "./quiz";

export async function router(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (pathname === "/") {
    return jsonResponse({ message: "Hello, world!" });
  }

  if (pathname === "/api/quiz" && req.method === "POST") {
    return handleQuiz(req);
  }

  if (pathname === "/health") {
    return handleHealth();
  }

  return new Response("Not found", { status: 404 });
}
