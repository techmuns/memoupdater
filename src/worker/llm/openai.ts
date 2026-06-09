import type {
  LlmGenerateArgs,
  LlmGenerateFailCode,
  LlmGenerateResult,
  LlmProvider,
} from "./types";
import { combineWithTimeout, isTimeoutError } from "./abort";
import { FOLLOW_UP_MEMO_OPENAI_SCHEMA } from "./parse";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MEMO_FORMAT_NAME = "follow_up_memo";
const TIMEOUT_MS = 60_000;

interface OpenAIAnnotation {
  type: string;
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

interface OpenAIContentBlock {
  type: string;
  text?: string;
  annotations?: OpenAIAnnotation[];
}

interface WebSearchSourceBlock {
  url?: string;
  title?: string;
  date?: string;
  snippet?: string;
}

interface OpenAIOutputBlock {
  type: string;
  content?: OpenAIContentBlock[];
  action?: { sources?: WebSearchSourceBlock[] };
}

export interface OpenAIResponsePayload {
  status?: string;
  error?: { code?: string; message?: string } | null;
  output?: OpenAIOutputBlock[];
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface CallOpenAIResponsesArgs {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  schema: object;
  schemaName: string;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: unknown;
  include?: string[];
  maxTokens?: number;
  abortSignal?: AbortSignal;
  logEventTag?: string;
}

export type CallOpenAIResponsesResult =
  | {
      ok: true;
      payload: OpenAIResponsePayload;
      parsed: unknown;
      inputTokens?: number;
      outputTokens?: number;
    }
  | {
      ok: false;
      code: LlmGenerateFailCode;
      message: string;
    };

// Shared low-level call to the OpenAI Responses API. Used by the memo
// provider (createOpenAIProvider below) and by the research route, which
// additionally passes:
//   - tools: [{type:"web_search"}] (+ optional tool_choice to force search)
//   - include: ["web_search_call.action.sources"] so the broader source
//     list is returned alongside the inline url_citation annotations.
// harvestWebSources() reads both channels. Never logs prompts, output text,
// source URLs/quotes, the API key, or any user secrets.
export async function callOpenAIResponses(
  args: CallOpenAIResponsesArgs,
): Promise<CallOpenAIResponsesResult> {
  const { signal, clear } = combineWithTimeout(args.abortSignal, TIMEOUT_MS);
  const eventTag = args.logEventTag ?? "llm_generate";
  try {
    const body: Record<string, unknown> = {
      model: args.model,
      instructions: args.system,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: args.user }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
    };
    if (typeof args.maxTokens === "number" && args.maxTokens > 0) {
      body.max_output_tokens = args.maxTokens;
    }
    if (args.tools && args.tools.length > 0) {
      body.tools = args.tools;
    }
    if (args.toolChoice !== undefined) {
      body.tool_choice = args.toolChoice;
    }
    if (args.include && args.include.length > 0) {
      body.include = args.include;
    }

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${args.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const aborted = signal.aborted;
      const timeout = isTimeoutError(err);
      if (aborted) {
        logFailure(eventTag, args.model, timeout ? "timeout" : "abort");
        return {
          ok: false,
          code: timeout ? "timeout" : "llm_error",
          message: timeout
            ? "LLM request timed out"
            : "LLM request was aborted",
        };
      }
      logFailure(eventTag, args.model, "network");
      return {
        ok: false,
        code: "llm_error",
        message: err instanceof Error ? err.message : "Network error",
      };
    }

    if (res.status === 401) {
      logFailure(eventTag, args.model, "unauthorized");
      return {
        ok: false,
        code: "not_configured",
        message: "Provider rejected the API key",
      };
    }
    if (res.status === 429) {
      logFailure(eventTag, args.model, "rate_limited");
      return {
        ok: false,
        code: "rate_limited",
        message: "Provider rate limit",
      };
    }
    if (!res.ok) {
      logFailure(eventTag, args.model, `http_${res.status}`);
      return {
        ok: false,
        code: "llm_error",
        message: `Provider returned HTTP ${res.status}`,
      };
    }

    let payload: OpenAIResponsePayload;
    try {
      payload = (await res.json()) as OpenAIResponsePayload;
    } catch {
      logFailure(eventTag, args.model, "json_parse");
      return {
        ok: false,
        code: "malformed_output",
        message: "Provider response was not valid JSON",
      };
    }

    if (payload.status === "failed") {
      logFailure(eventTag, args.model, "response_failed");
      return {
        ok: false,
        code: "llm_error",
        message: payload.error?.message ?? "Provider response failed",
      };
    }

    if (hasRefusal(payload.output)) {
      logFailure(eventTag, args.model, "refusal");
      return {
        ok: false,
        code: "malformed_output",
        message: "Provider refused the request",
      };
    }

    const text = extractOutputText(payload);
    if (!text) {
      logFailure(eventTag, args.model, "no_output");
      return {
        ok: false,
        code: "malformed_output",
        message: "Provider response had no output_text",
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      logFailure(eventTag, args.model, "output_parse");
      return {
        ok: false,
        code: "malformed_output",
        message: "Provider output_text was not valid JSON",
      };
    }

    const inputTokens = payload.usage?.input_tokens;
    const outputTokens = payload.usage?.output_tokens;
    console.log(
      JSON.stringify({
        event: `${eventTag}_ok`,
        provider: "openai",
        model: args.model,
        inputTokens,
        outputTokens,
      }),
    );
    return {
      ok: true,
      payload,
      parsed,
      inputTokens,
      outputTokens,
    };
  } finally {
    clear();
  }
}

export function createOpenAIProvider(
  apiKey: string,
  model: string,
): LlmProvider {
  return {
    providerName: "openai",
    modelUsed: model,
    async generate(args: LlmGenerateArgs): Promise<LlmGenerateResult> {
      const result = await callOpenAIResponses({
        apiKey,
        model,
        system: args.system,
        user: args.user,
        schema: FOLLOW_UP_MEMO_OPENAI_SCHEMA,
        schemaName: MEMO_FORMAT_NAME,
        maxTokens: args.maxTokens,
        abortSignal: args.abortSignal,
        logEventTag: "llm_generate",
      });
      if (!result.ok) {
        return {
          ok: false,
          code: result.code,
          message: result.message,
          providerName: "openai",
          modelUsed: model,
        };
      }
      return {
        ok: true,
        json: normalizeMemoNulls(result.parsed),
        providerName: "openai",
        modelUsed: model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    },
  };
}

// Harvest web-search citations from a Responses-API payload. Reads BOTH:
//   (a) primary channel — output[].content[].annotations[] entries with
//       type === "url_citation"; always present when the model cites.
//   (b) secondary channel — output[].action.sources on "web_search_call"
//       blocks; only present when the request body includes
//       include: ["web_search_call.action.sources"].
// Returns a normalized-URL map (so the research route's validator can
// verify model-emitted finding sources by direct URL match) plus integer
// counts the route uses for a safe debug log.
export interface HarvestedWebSources {
  byUrl: Map<string, { title?: string; date?: string }>;
  webSearchCallCount: number;
  urlCitationCount: number;
  webSearchSourceCount: number;
}

export function harvestWebSources(
  payload: OpenAIResponsePayload,
): HarvestedWebSources {
  const byUrl = new Map<string, { title?: string; date?: string }>();
  let webSearchCallCount = 0;
  let urlCitationCount = 0;
  let webSearchSourceCount = 0;

  const merge = (
    rawUrl: string,
    meta: { title?: string; date?: string },
  ): void => {
    const key = normalizeUrl(rawUrl);
    if (!key) return;
    const existing = byUrl.get(key);
    byUrl.set(key, {
      title: existing?.title ?? meta.title,
      date: existing?.date ?? meta.date,
    });
  };

  for (const block of payload.output ?? []) {
    if (block.type === "web_search_call") {
      webSearchCallCount += 1;
      for (const src of block.action?.sources ?? []) {
        if (typeof src.url !== "string" || src.url.length === 0) continue;
        webSearchSourceCount += 1;
        merge(src.url, { title: src.title, date: src.date });
      }
      continue;
    }
    for (const c of block.content ?? []) {
      for (const a of c.annotations ?? []) {
        if (a.type !== "url_citation") continue;
        if (typeof a.url !== "string" || a.url.length === 0) continue;
        urlCitationCount += 1;
        merge(a.url, { title: a.title });
      }
    }
  }

  return { byUrl, webSearchCallCount, urlCitationCount, webSearchSourceCount };
}

// Normalize a URL for citation-vs-finding matching. Lowercase host, drop
// hash, strip common tracking params, and remove a single trailing slash
// on the pathname. Returns null when the URL is unparseable.
const TRACKING_PARAM_RE = /^(utm_|fbclid$|gclid$|ref$|ref_src$|mc_cid$|mc_eid$)/i;
export function normalizeUrl(raw: string): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  const params = u.searchParams;
  const toDelete: string[] = [];
  params.forEach((_, key) => {
    if (TRACKING_PARAM_RE.test(key)) toDelete.push(key);
  });
  for (const k of toDelete) params.delete(k);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

function hasRefusal(output: OpenAIOutputBlock[] | undefined): boolean {
  if (!output) return false;
  for (const block of output) {
    if (block.type === "refusal") return true;
    for (const c of block.content ?? []) {
      if (c.type === "refusal") return true;
    }
  }
  return false;
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (
    typeof payload.output_text === "string" &&
    payload.output_text.length > 0
  ) {
    return payload.output_text;
  }
  const parts: string[] = [];
  for (const block of payload.output ?? []) {
    for (const c of block.content ?? []) {
      if (c.type === "output_text" && typeof c.text === "string") {
        parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

// Strip nulls on the known nullable fields of the memo schema so result.json
// mirrors the "absent = undefined" shape produced by Anthropic's tool_use.
function normalizeMemoNulls(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (out.manualChecksRemaining === null) delete out.manualChecksRemaining;
  const sections = out.sections;
  if (!Array.isArray(sections)) return out;
  const cleanSections = sections.map((s) => {
    if (!isPlainObject(s)) return s;
    const copy: Record<string, unknown> = { ...s };
    if (copy.confidenceNote === null) delete copy.confidenceNote;
    if (copy.confidence === null) delete copy.confidence;
    if (copy.bridge === null) delete copy.bridge;
    if (Array.isArray(copy.bridge)) {
      copy.bridge = copy.bridge.map((row) => {
        if (!isPlainObject(row)) return row;
        const rc: Record<string, unknown> = { ...row };
        if (rc.original === null) delete rc.original;
        if (rc.latest === null) delete rc.latest;
        if (rc.readThrough === null) delete rc.readThrough;
        return rc;
      });
    }
    const sources = copy.sources;
    if (Array.isArray(sources)) {
      copy.sources = sources.map((src) => {
        if (!isPlainObject(src)) return src;
        const sc: Record<string, unknown> = { ...src };
        if (sc.page === null) delete sc.page;
        if (sc.quote === null) delete sc.quote;
        return sc;
      });
    }
    return copy;
  });
  out.sections = cleanSections;
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function logFailure(
  eventTag: string,
  model: string,
  errorType: string,
): void {
  console.log(
    JSON.stringify({
      event: `${eventTag}_fail`,
      provider: "openai",
      model,
      errorType,
    }),
  );
}
