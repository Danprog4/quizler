import { jsonResponse } from "../lib/http";

export function handleHealth(): Response {
  return jsonResponse({ ok: true });
}
