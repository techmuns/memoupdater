import { Hono } from "hono";
import { demoProject } from "@shared/demo/rategain-project";
import { demoMemoDna } from "@shared/demo/rategain-memo-dna";
import { demoFollowUpMemo } from "@shared/demo/rategain-follow-up-memo";
import type {
  GenerateFollowUpMemoRequest,
  GenerateFollowUpMemoResponse,
  HealthResponse,
  LlmStatusResponse,
} from "@shared/types";
import { describeProvider, getProvider } from "./llm/provider";
import { buildPrompt } from "./llm/prompt";
import { FOLLOW_UP_MEMO_TOOL_SCHEMA, parseLlmJson } from "./llm/parse";
import { trimRequestBody } from "./llm/trim";

const app = new Hono<{ Bindings: Env }>();

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_TOKENS = 8000;
const HARD_MAX_OUTPUT_TOKENS = 12_000;
const MAX_UPDATE_DOCS = 12;

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

app.get("/api/llm/status", (c) => {
  const provider = getProvider(c.env);
  const description = describeProvider(c.env);
  const body: LlmStatusResponse = provider
    ? {
        configured: true,
        provider: provider.providerName,
        model: provider.modelUsed,
        fallbackAvailable: true,
      }
    : {
        configured: false,
        provider: description.provider,
        model: description.model,
        fallbackAvailable: true,
      };
  return c.json(body);
});

app.post("/api/generate/follow-up-memo", async (c) => {
  const declaredLength = Number(c.req.header("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return c.json({ error: "body_too_large" }, 413);
  }

  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json({ error: "body_unreadable" }, 400);
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return c.json({ error: "body_too_large" }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const validation = validateGenerateRequest(parsed);
  if (!validation.ok) {
    return c.json(
      { error: "invalid_request", message: validation.message },
      400,
    );
  }

  const provider = getProvider(c.env);
  if (!provider) {
    const body: GenerateFollowUpMemoResponse = {
      ok: false,
      code: "not_configured",
      message: "LLM generation is not enabled on this server.",
      fallbackAvailable: true,
    };
    return c.json(body);
  }

  const request = trimRequestBody(validation.value);
  const maxTokens = clampMaxTokens(request.generationOptions?.maxTokens);
  const { system, user, jsonSchema } = buildPrompt(
    request,
    FOLLOW_UP_MEMO_TOOL_SCHEMA,
  );

  const result = await provider.generate({
    system,
    user,
    jsonSchema,
    maxTokens,
    abortSignal: c.req.raw.signal,
  });

  if (!result.ok) {
    const body: GenerateFollowUpMemoResponse = {
      ok: false,
      code: result.code,
      message: result.message,
      providerName: result.providerName,
      modelUsed: result.modelUsed,
      fallbackAvailable: true,
    };
    return c.json(body);
  }

  const generatedAt = new Date().toISOString();
  const parsedMemo = parseLlmJson(result.json, request, generatedAt);
  if (!parsedMemo.ok) {
    const body: GenerateFollowUpMemoResponse = {
      ok: false,
      code: parsedMemo.code,
      message: parsedMemo.message,
      providerName: result.providerName,
      modelUsed: result.modelUsed,
      fallbackAvailable: true,
    };
    return c.json(body);
  }

  const body: GenerateFollowUpMemoResponse = {
    ok: true,
    memo: parsedMemo.memo,
    providerMetadata: {
      providerName: result.providerName,
      modelUsed: result.modelUsed,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
    warnings: parsedMemo.warnings,
  };
  return c.json(body);
});

app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "not_found", path: c.req.path }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

function clampMaxTokens(requested: number | undefined): number {
  if (
    typeof requested !== "number" ||
    !Number.isFinite(requested) ||
    requested <= 0
  ) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }
  return Math.min(Math.floor(requested), HARD_MAX_OUTPUT_TOKENS);
}

type ValidationResult =
  | { ok: true; value: GenerateFollowUpMemoRequest }
  | { ok: false; message: string };

function validateGenerateRequest(input: unknown): ValidationResult {
  if (!isPlainObject(input)) return invalid("request must be an object");

  const project = input.project;
  if (!isPlainObject(project)) return invalid("project missing");
  if (typeof project.id !== "string") return invalid("project.id missing");
  if (typeof project.ticker !== "string")
    return invalid("project.ticker missing");
  if (typeof project.companyName !== "string")
    return invalid("project.companyName missing");

  const initialMemo = input.initialMemo;
  if (!isPlainObject(initialMemo)) return invalid("initialMemo missing");
  if (typeof initialMemo.text !== "string")
    return invalid("initialMemo.text missing");
  if (typeof initialMemo.sourceFilename !== "string")
    return invalid("initialMemo.sourceFilename missing");
  if (typeof initialMemo.sizeBytes !== "number")
    return invalid("initialMemo.sizeBytes missing");

  const updateDocs = input.updateDocs;
  if (!Array.isArray(updateDocs))
    return invalid("updateDocs must be an array");
  if (updateDocs.length > MAX_UPDATE_DOCS)
    return invalid(`too many updateDocs (>${MAX_UPDATE_DOCS})`);
  for (const doc of updateDocs) {
    if (!isPlainObject(doc)) return invalid("updateDoc not an object");
    if (typeof doc.id !== "string") return invalid("updateDoc.id missing");
    if (typeof doc.kind !== "string")
      return invalid("updateDoc.kind missing");
    if (typeof doc.filename !== "string")
      return invalid("updateDoc.filename missing");
    if (typeof doc.text !== "string")
      return invalid("updateDoc.text missing");
  }

  if (!isPlainObject(input.dna)) return invalid("dna missing");
  if (!isPlainObject(input.analysis)) return invalid("analysis missing");

  return { ok: true, value: input as unknown as GenerateFollowUpMemoRequest };
}

function invalid(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default app;
