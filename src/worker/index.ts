import { Hono } from "hono";
import { demoProject } from "@shared/demo/rategain-project";
import { demoMemoDna } from "@shared/demo/rategain-memo-dna";
import { demoFollowUpMemo } from "@shared/demo/rategain-follow-up-memo";
import type { HealthResponse } from "@shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  const body: HealthResponse = {
    status: "ok",
    phase: "1-demo",
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});

app.get("/api/demo/project", (c) => c.json(demoProject));
app.get("/api/demo/memo-dna", (c) => c.json(demoMemoDna));
app.get("/api/demo/follow-up-memo", (c) => c.json(demoFollowUpMemo));

// TODO Phase 2:
//   POST   /api/projects                    create project (D1)
//   POST   /api/projects/:id/uploads        sign R2 upload, persist UploadedDocument
//   POST   /api/projects/:id/dna            enqueue MemoDNA extraction (Queues/Workflows + LLM)
//   POST   /api/projects/:id/follow-up      enqueue FollowUpMemo generation
//   GET    /api/projects/:id/runs/:runId    poll GenerationRun status

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "not_found", path: c.req.path }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
