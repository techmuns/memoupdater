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

  it("captures CURRENT trailing fundamentals from Yahoo v7 + v10 (no forward fields)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("query1.finance.yahoo.com/v7/finance/quote")) {
          // v7 carries price, trailing P/E, trailing EPS, market cap, P/B,
          // book value, 52w range. NOT enterprise value / EV-EBITDA — those
          // live in v10 quoteSummary (next branch).
          return new Response(
            JSON.stringify({
              quoteResponse: {
                result: [
                  {
                    symbol: "RATEGAIN.NS",
                    regularMarketPrice: 871.45,
                    currency: "INR",
                    trailingPE: 46.18,
                    epsTrailingTwelveMonths: 18.87,
                    marketCap: 89_600_000_000,
                    priceToBook: 5.2,
                    bookValue: 167.6,
                    fiftyTwoWeekHigh: 902,
                    fiftyTwoWeekLow: 417.6,
                  },
                ],
              },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/v10/finance/quoteSummary/")) {
          return new Response(
            JSON.stringify({
              quoteSummary: {
                result: [
                  {
                    defaultKeyStatistics: {
                      enterpriseValue: { raw: 92_100_000_000 },
                      enterpriseToEbitda: { raw: 28.1 },
                    },
                  },
                ],
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
      expect(body.trailingPE).toBe(46.18);
      expect(body.trailingEps).toBe(18.87);
      expect(body.marketCap).toBe(89_600_000_000);
      expect(body.enterpriseValue).toBe(92_100_000_000);
      expect(body.trailingEvToEbitda).toBe(28.1);
      expect(body.priceToBook).toBe(5.2);
      expect(body.bookValue).toBe(167.6);
      expect(body.fiftyTwoWeekHigh).toBe(902);
      expect(body.fiftyTwoWeekLow).toBe(417.6);
      // Forward fields are NOT in the response shape anymore (analyst rule).
      expect("forwardEps" in body).toBe(false);
      expect("forwardPE" in body).toBe(false);
      // Fundamentals display string carries every captured trailing metric.
      expect(body.fundamentalsDisplay).toContain("mkt cap");
      expect(body.fundamentalsDisplay).toContain("trailing P/E 46.2x");
      expect(body.fundamentalsDisplay).toContain("trailing EV/EBITDA 28.1x");
      expect(body.fundamentalsDisplay).toContain("P/B 5.20x");
      expect(body.fundamentalsDisplay).toContain("52w 417.60–902.00");
      expect(body.fundamentalsDisplay).not.toMatch(/forward/i);
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
