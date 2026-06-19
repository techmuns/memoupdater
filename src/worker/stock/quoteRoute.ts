// Live stock-quote proxy. POST /api/stock/quote fetches the CURRENT share
// price for a ticker server-side, so the memo-generation pipeline doesn't
// have to rely on the LLM's web_search tool (which routinely surfaces a
// stale news-article snippet instead of the live quote widget).
//
// Source strategy (JSON-first; HTML scraping only as last resort because
// Google/Yahoo/Screener HTML front-ends increasingly 403 server IPs):
//   1. Yahoo Finance v8 chart JSON   — clean JSON, used by most open-source
//                                      financial tools, works for global tickers
//                                      (.NS for NSE, .BO for BSE, bare for US).
//   2. Stooq CSV                     — simple CSV, no auth, global coverage
//                                      (rategain.in, aapl.us, etc).
//   3. Google Finance HTML scrape    — readable HTML when reachable.
//   4. Screener.in HTML scrape (IN)  — Indian-ticker fallback.
//
// The first source that returns a parseable price wins. Every failure case
// returns HTTP 200 { ok:false } so the client falls back gracefully (the LLM
// then uses its own web_search rules). NEVER logs upstream bodies.
import type { Context } from "hono";
import type { StockQuoteResponse } from "@shared/types";
import { combineWithTimeout } from "../llm/abort";

const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 2 * 1024;
// Realistic UA so HTML pages (when reached) serve the price widget instead of
// a stripped no-script version. The JSON endpoints don't care about UA.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function handleStockQuote(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json(fail("invalid_request", "Request body unreadable."));
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return c.json(fail("invalid_request", "Request body too large."));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return c.json(fail("invalid_request", "Request body must be JSON."));
  }
  const obj =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  const ticker = sanitiseTicker(typeof obj?.ticker === "string" ? obj.ticker : "");
  if (!ticker) {
    return c.json(fail("invalid_request", "A non-empty 'ticker' is required."));
  }
  const country = strOrUndef(obj?.country);
  const exchangeHint = strOrUndef(obj?.exchange)?.toUpperCase();
  const signal = c.req.raw.signal;
  const today = new Date().toISOString().slice(0, 10);

  // 1. Yahoo v8 chart — preferred (JSON, intraday-fresh, global coverage).
  for (const sym of yahooSymbolsFor(ticker, exchangeHint, country)) {
    const got = await tryYahooChartJson(sym, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 2. Stooq CSV — broad coverage, no auth.
  for (const sym of stooqSymbolsFor(ticker, exchangeHint, country)) {
    const got = await tryStooqCsv(sym, ticker, exchangeHint, country, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 3. Google Finance HTML — readable when reachable.
  for (const ex of googleExchangesFor(exchangeHint, country)) {
    const got = await tryGoogleFinanceHtml(ticker, ex, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 4. Screener.in HTML — Indian ticker last-resort.
  if (looksIndian(exchangeHint, country)) {
    const got = await tryScreenerHtml(ticker, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }

  console.log(
    JSON.stringify({
      event: "stock_quote_not_found",
      tickerLen: ticker.length,
    }),
  );
  return c.json(
    fail(
      "not_found",
      "Could not locate a current price for this ticker from Yahoo / Stooq / Google Finance / Screener.",
    ),
  );
}

interface RawQuote {
  price: number;
  currency: string;
  source: string;
}

function buildOk(q: RawQuote, ticker: string, asOf: string): StockQuoteResponse {
  const displaySym = q.currency === "INR" ? "Rs " : `${q.currency} `;
  const display = `${displaySym}${formatPrice(q.price)} (as of ${asOf}, ${q.source})`;
  return {
    ok: true,
    ticker,
    price: q.price,
    currency: q.currency,
    asOf,
    source: q.source,
    display,
  };
}

function formatPrice(p: number): string {
  return p >= 1000
    ? p.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : p.toFixed(2);
}

function fail(
  code: Extract<StockQuoteResponse, { ok: false }>["code"],
  message: string,
): StockQuoteResponse {
  return { ok: false, code, message };
}

function sanitiseTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9.\-&]/g, "").slice(0, 20);
}

function strOrUndef(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function looksIndian(exchange: string | undefined, country: string | undefined): boolean {
  const ex = exchange?.toUpperCase() ?? "";
  if (ex === "NSE" || ex === "BSE") return true;
  return /india/i.test(country ?? "");
}

// Yahoo Finance symbol suffixes — bare for US tickers, .NS/.BO for India, etc.
function yahooSymbolsFor(
  ticker: string,
  exchange: string | undefined,
  country: string | undefined,
): string[] {
  const ex = exchange?.toUpperCase();
  if (ex === "NSE") return [`${ticker}.NS`];
  if (ex === "BSE") return [`${ticker}.BO`];
  if (ex === "LON") return [`${ticker}.L`];
  if (looksIndian(ex, country)) return [`${ticker}.NS`, `${ticker}.BO`];
  if (/united\s*states|usa|u\.s\./i.test(country ?? "")) return [ticker];
  // Country unknown — try all the common variants in priority order.
  return [ticker, `${ticker}.NS`, `${ticker}.BO`];
}

function stooqSymbolsFor(
  ticker: string,
  exchange: string | undefined,
  country: string | undefined,
): string[] {
  const t = ticker.toLowerCase();
  const ex = exchange?.toUpperCase();
  if (looksIndian(ex, country)) return [`${t}.in`];
  if (/united\s*states|usa|u\.s\./i.test(country ?? "")) return [`${t}.us`];
  return [`${t}.us`, `${t}.in`];
}

function googleExchangesFor(
  exchange: string | undefined,
  country: string | undefined,
): string[] {
  const ex = exchange?.toUpperCase();
  const out: string[] = [];
  if (ex) out.push(ex);
  if (looksIndian(ex, country)) {
    if (!out.includes("NSE")) out.push("NSE");
    if (!out.includes("BSE")) out.push("BSE");
  } else if (/united\s*states|usa|u\.s\./i.test(country ?? "")) {
    for (const e of ["NASDAQ", "NYSE", "AMEX"]) {
      if (!out.includes(e)) out.push(e);
    }
  }
  return out;
}

// --- Source 1: Yahoo Finance v8 chart JSON --------------------------------

interface YahooChartShape {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
        exchangeName?: string;
        symbol?: string;
      };
    }>;
    error?: unknown;
  };
}

async function tryYahooChartJson(
  sym: string,
  signal: AbortSignal,
): Promise<RawQuote | null> {
  // v8 chart endpoint: returns regularMarketPrice + currency in `meta`.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym,
  )}?interval=1d&range=1d`;
  const body = await safeFetchText(url, signal, "application/json");
  if (!body) return null;
  let json: YahooChartShape;
  try {
    json = JSON.parse(body) as YahooChartShape;
  } catch {
    return null;
  }
  const meta = json.chart?.result?.[0]?.meta;
  const price =
    typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const currency = typeof meta?.currency === "string" ? meta.currency : null;
  if (price == null || !currency) return null;
  return { price, currency, source: `Yahoo Finance · ${sym}` };
}

// --- Source 2: Stooq CSV ---------------------------------------------------

async function tryStooqCsv(
  stooqSym: string,
  ticker: string,
  exchange: string | undefined,
  country: string | undefined,
  signal: AbortSignal,
): Promise<RawQuote | null> {
  // CSV columns: Symbol,Date,Time,Open,High,Low,Close,Volume.
  const url = `https://stooq.com/q/?s=${encodeURIComponent(
    stooqSym,
  )}&f=sd2t2ohlcv&h&e=csv`;
  const body = await safeFetchText(url, signal, "text/csv");
  if (!body) return null;
  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const row = lines[1].split(",");
  // Symbol(0), Date(1), Time(2), Open(3), High(4), Low(5), Close(6), Volume(7)
  if (row.length < 7) return null;
  const close = parseNum(row[6]);
  if (close == null || close <= 0) return null;
  const currency = inferCurrency(stooqSym, exchange, country);
  return { price: close, currency, source: `Stooq · ${ticker} (${row[1] || "latest"})` };
}

function inferCurrency(
  stooqSym: string,
  exchange: string | undefined,
  country: string | undefined,
): string {
  if (stooqSym.endsWith(".in") || looksIndian(exchange, country)) return "INR";
  if (stooqSym.endsWith(".uk")) return "GBP";
  if (stooqSym.endsWith(".de")) return "EUR";
  if (stooqSym.endsWith(".jp")) return "JPY";
  return "USD";
}

// --- Source 3: Google Finance HTML ----------------------------------------

async function tryGoogleFinanceHtml(
  ticker: string,
  exchange: string,
  signal: AbortSignal,
): Promise<RawQuote | null> {
  const url = `https://www.google.com/finance/quote/${encodeURIComponent(
    ticker,
  )}:${encodeURIComponent(exchange)}`;
  const html = await safeFetchText(url, signal);
  if (!html) return null;
  // Price element class (current as of writing) + data-last-price fallback.
  const ymKey = html.match(
    /class="YMlKec[^"]*"[^>]*>\s*([₹$£€¥]?)\s*([0-9][\d,]*\.?\d*)/,
  );
  const attr = html.match(/data-last-price="([0-9]+(?:\.[0-9]+)?)"/);
  const ccyAttr = html.match(/data-currency-code="([A-Z]{3})"/);
  let price: number | null = null;
  let currency: string | null = null;
  if (ymKey) {
    price = parseNum(ymKey[2]);
    currency = symbolToCcy(ymKey[1]) ?? ccyAttr?.[1] ?? null;
  } else if (attr) {
    price = parseNum(attr[1]);
    currency = ccyAttr?.[1] ?? null;
  }
  if (price == null || !currency) return null;
  return { price, currency, source: `Google Finance · ${ticker}:${exchange}` };
}

// --- Source 4: Screener.in HTML (INR only) --------------------------------

async function tryScreenerHtml(
  ticker: string,
  signal: AbortSignal,
): Promise<RawQuote | null> {
  const url = `https://www.screener.in/company/${encodeURIComponent(ticker)}/consolidated/`;
  const html = await safeFetchText(url, signal);
  if (!html) return null;
  const a = html.match(/₹\s*<span[^>]*>\s*([0-9][\d,]*\.?\d*)\s*<\/span>/);
  const b = html.match(/₹\s*([0-9][\d,]*\.?\d*)/);
  const m = a ?? b;
  if (!m) return null;
  const price = parseNum(m[1]);
  if (price == null) return null;
  return { price, currency: "INR", source: `Screener.in · ${ticker}` };
}

// --- Helpers ---------------------------------------------------------------

async function safeFetchText(
  url: string,
  userSignal: AbortSignal,
  accept: string = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
): Promise<string | null> {
  const combined = combineWithTimeout(userSignal, UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: combined.signal,
      headers: {
        "user-agent": UA,
        accept,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    combined.clear();
  }
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function symbolToCcy(sym: string | undefined): string | null {
  switch (sym) {
    case "₹":
      return "INR";
    case "$":
      return "USD";
    case "£":
      return "GBP";
    case "€":
      return "EUR";
    case "¥":
      return "JPY";
    default:
      return null;
  }
}
