import { describe, it, expect, vi, afterEach } from "vitest";
import {
  callOpenAIResponses,
  defaultReasoningEffort,
  defaultTimeoutMs,
  isReasoningModel,
} from "../src/worker/llm/openai";

// Regression guard for the recurring "incomplete: max_output_tokens" /
// parse_error class. On reasoning models max_output_tokens is shared between
// hidden reasoning and the visible JSON; if a call site forgets to bound the
// reasoning effort the JSON truncates. callOpenAIResponses must therefore
// apply a safe default so NO caller (section generation, repair, the main
// memo path, or any future route) can silently reintroduce the bug.

const OK_PAYLOAD = {
  status: "completed",
  output_text: JSON.stringify({ hello: "world" }),
  usage: { input_tokens: 10, output_tokens: 5 },
};

function mockFetchCapturing(): { bodies: Array<Record<string, unknown>> } {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify(OK_PAYLOAD), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return { bodies };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE_ARGS = {
  apiKey: "test-key",
  system: "sys",
  user: "usr",
  schema: { type: "object" },
  schemaName: "test",
} as const;

describe("isReasoningModel", () => {
  it("matches gpt-5.x and o-series", () => {
    for (const m of ["gpt-5.5", "gpt-5.2", "gpt-5", "o1", "o3-mini"]) {
      expect(isReasoningModel(m)).toBe(true);
    }
  });
  it("does not match non-reasoning models or undefined", () => {
    for (const m of ["gpt-4o", "gpt-4.1", "claude-sonnet-4-6"]) {
      expect(isReasoningModel(m)).toBe(false);
    }
    expect(isReasoningModel(undefined)).toBe(false);
  });
});

describe("defaultReasoningEffort", () => {
  it("is low for reasoning models, undefined otherwise", () => {
    expect(defaultReasoningEffort("gpt-5.5")).toBe("low");
    expect(defaultReasoningEffort("gpt-4o")).toBeUndefined();
    expect(defaultReasoningEffort(undefined)).toBeUndefined();
  });
});

describe("defaultTimeoutMs", () => {
  it("gives reasoning models a longer ceiling so big extractions finish", () => {
    // 90s for gpt-5.x / o*, under Cloudflare's ~100s edge limit. The
    // memo-understanding extraction was timing out into the regex baseline
    // at the old 60s default.
    expect(defaultTimeoutMs("gpt-5.5")).toBe(90_000);
    expect(defaultTimeoutMs("gpt-5.2")).toBe(90_000);
    expect(defaultTimeoutMs("o3-mini")).toBe(90_000);
  });
  it("keeps 60s for non-reasoning models / unknown", () => {
    expect(defaultTimeoutMs("gpt-4o")).toBe(60_000);
    expect(defaultTimeoutMs(undefined)).toBe(60_000);
  });
});

describe("callOpenAIResponses reasoning defaults", () => {
  it("defaults effort to low for a reasoning model when the caller omits it", async () => {
    const { bodies } = mockFetchCapturing();
    const res = await callOpenAIResponses({
      ...BASE_ARGS,
      model: "gpt-5.5",
      maxTokens: 3000,
    });
    expect(res.ok).toBe(true);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].reasoning).toEqual({ effort: "low" });
    expect(bodies[0].max_output_tokens).toBe(3000);
  });

  it("omits the reasoning param for non-reasoning models (they reject it)", async () => {
    const { bodies } = mockFetchCapturing();
    await callOpenAIResponses({ ...BASE_ARGS, model: "gpt-4o" });
    expect(bodies[0].reasoning).toBeUndefined();
  });

  it("lets an explicit caller effort win over the default", async () => {
    const { bodies } = mockFetchCapturing();
    await callOpenAIResponses({
      ...BASE_ARGS,
      model: "gpt-5.5",
      reasoningEffort: "high",
    });
    expect(bodies[0].reasoning).toEqual({ effort: "high" });
  });
});
