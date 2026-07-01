import { describe, expect, it } from "vitest";
import { handleReportAsk } from "../src/worker/report/askRoute";

// Validation + safe-failure for the Q&A route. With an unconfigured env the
// route returns 200 { ok:false } (never throws), and malformed requests 400 —
// both without touching the network.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(body: unknown, env: Record<string, unknown> = {}): any {
  const text = JSON.stringify(body);
  return {
    env,
    req: {
      header: (name: string) =>
        name === "content-length" ? String(text.length) : undefined,
      raw: { text: async () => text, signal: undefined },
    },
    json: (obj: unknown, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "content-type": "application/json" },
      }),
  };
}

const validBody = {
  question: "What is the biggest risk?",
  company: "RateGain",
  report: [{ title: "Updated view", markdown: "Thesis intact. Risk: AI disruption." }],
};

describe("report ask route", () => {
  it("returns 200 safe-failure when the LLM is not configured", async () => {
    const res = await handleReportAsk(makeCtx(validBody));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.ok).toBe(false);
    expect(b.code).toBe("not_configured");
  });

  it("400s a request with no question", async () => {
    const res = await handleReportAsk(makeCtx({ ...validBody, question: "" }));
    expect(res.status).toBe(400);
  });

  it("400s a request with an empty report", async () => {
    const res = await handleReportAsk(makeCtx({ ...validBody, report: [] }));
    expect(res.status).toBe(400);
  });
});
