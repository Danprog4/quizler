import { router } from "./routes";

Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  fetch: router,
});
