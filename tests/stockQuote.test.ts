import { describe, it, expect, vi, afterEach } from "vitest";
import { handleStockQuote } from "../src/worker/stock/quoteRoute";
import type { StockQuoteResponse } from "../src/shared/types";

// Minimal Hono-context stub for the route. We don't need the full framework,
// just c.req.raw + c.json. The route is pure (no env access for this path).
function buildContext(body: object): {
  req: { raw: Request };
  json: (v: unknown) => Response;
} {
  return {
    req: { raw: new Request("https://x/", { method: "POST", body: JSON.stringify(body) }) },
    json: (v: unknown) =>
      new Response(JSON.stringify(v), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  };
}

async function parsed(res: Response): Promise<StockQuoteResponse> {
  return (await res.json()) as StockQuoteResponse;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stockQuote route", () => {
  it("rejects requests without a ticker", async () => {
    vi.stubGlobal("fetch", vi.fn());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await handleStockQuote(buildContext({}) as any);
    const body = await parsed(res);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.code).toBe("invalid_request");
  });

  it("parses a Yahoo Finance v8 chart response and returns price/currency/asOf/display", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("query1.finance.yahoo.com/v8/finance/chart/RATEGAIN.NS")) {
          return new Response(
            JSON.stringify({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 871.45,
                      currency: "INR",
                      exchangeName: "NSI",
                      symbol: "RATEGAIN.NS",
                    },
                  },
                ],
                error: null,
              },
            }),
            { status: 200 },
          );
        }
        return new Response("nope", { status: 404 });
      }),
    );
    const res = await handleStockQuote(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildContext({ ticker: "RATEGAIN", country: "India" }) as any,
    );
    const body = await parsed(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.price).toBe(871.45);
      expect(body.currency).toBe("INR");
      expect(body.source).toContain("Yahoo Finance");
      // The display string is what the LLM uses verbatim — must carry the
      // currency, price, as-of date, and a source label.
      expect(body.display).toMatch(/^Rs 871\.45 \(as of \d{4}-\d{2}-\d{2}, Yahoo Finance/);
      expect(body.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("falls back to Stooq CSV when Yahoo returns nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("query1.finance.yahoo.com")) {
          return new Response("denied", { status: 403 });
        }
        if (url.includes("stooq.com")) {
          // CSV: Symbol,Date,Time,Open,High,Low,Close,Volume
          return new Response(
            "Symbol,Date,Time,Open,High,Low,Close,Volume\nRATEGAIN.IN,2026-06-19,16:00,865.0,902.0,860.0,871.45,1234567\n",
            { status: 200 },
          );
        }
        return new Response("nope", { status: 404 });
      }),
    );
    const res = await handleStockQuote(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildContext({ ticker: "RATEGAIN", country: "India" }) as any,
    );
    const body = await parsed(res);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.price).toBe(871.45);
      expect(body.currency).toBe("INR");
      expect(body.source).toContain("Stooq");
    }
  });

  it("returns not_found gracefully when every source fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("blocked", { status: 403 })));
    const res = await handleStockQuote(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildContext({ ticker: "RATEGAIN", country: "India" }) as any,
    );
    const body = await parsed(res);
    expect(body.ok).toBe(false);
    if (!body.ok) expect(body.code).toBe("not_found");
  });
});
