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

  // 1. Yahoo v7 /quote — preferred. Returns price + trailing/forward EPS,
  // trailing/forward P/E, market cap and 52-week range in a single JSON
  // payload, so the model never has to "verify" any of these via web_search.
  for (const sym of yahooSymbolsFor(ticker, exchangeHint, country)) {
    const got = await tryYahooQuoteJson(sym, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 2. Yahoo v8 chart — JSON fallback, price only.
  for (const sym of yahooSymbolsFor(ticker, exchangeHint, country)) {
    const got = await tryYahooChartJson(sym, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 3. Stooq CSV — broad coverage, no auth, price + recent close date.
  for (const sym of stooqSymbolsFor(ticker, exchangeHint, country)) {
    const got = await tryStooqCsv(sym, ticker, exchangeHint, country, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 4. Google Finance HTML — readable when reachable.
  for (const ex of googleExchangesFor(exchangeHint, country)) {
    const got = await tryGoogleFinanceHtml(ticker, ex, signal);
    if (got) return c.json(buildOk(got, ticker, today));
  }
  // 5. Screener.in HTML — Indian ticker last-resort.
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
  // CURRENT metrics only — forward valuations are intentionally omitted (the
  // analyst doesn't want them in the output, and they're not deterministic).
  trailingEps?: number;
  trailingPE?: number;
  marketCap?: number;
  enterpriseValue?: number;
  trailingEvToEbitda?: number;
  priceToBook?: number;
  bookValue?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

function buildOk(q: RawQuote, ticker: string, asOf: string): StockQuoteResponse {
  const displaySym = q.currency === "INR" ? "Rs " : `${q.currency} `;
  const display = `${displaySym}${formatPrice(q.price)} (as of ${asOf}, ${q.source})`;
  // Compose a compact fundamentals summary the section prompt can use
  // verbatim. CURRENT metrics only — no forward / forecast figures (the
  // analyst's requirement: present only sourced facts, not projections).
  const bits: string[] = [];
  if (q.marketCap != null) bits.push(`mkt cap ${displaySym}${compactMoney(q.marketCap, q.currency)}`);
  if (q.enterpriseValue != null) bits.push(`EV ${displaySym}${compactMoney(q.enterpriseValue, q.currency)}`);
  if (q.trailingPE != null) bits.push(`trailing P/E ${q.trailingPE.toFixed(1)}x`);
  if (q.trailingEvToEbitda != null) bits.push(`trailing EV/EBITDA ${q.trailingEvToEbitda.toFixed(1)}x`);
  if (q.priceToBook != null) bits.push(`P/B ${q.priceToBook.toFixed(2)}x`);
  if (q.bookValue != null) bits.push(`book value ${displaySym}${formatPrice(q.bookValue)}`);
  if (q.trailingEps != null) bits.push(`trailing EPS ${displaySym}${formatPrice(q.trailingEps)}`);
  if (q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null) {
    bits.push(`52w ${formatPrice(q.fiftyTwoWeekLow)}–${formatPrice(q.fiftyTwoWeekHigh)}`);
  }
  const fundamentalsDisplay = bits.length > 0
    ? `${display}; ${bits.join("; ")}`
    : undefined;
  return {
    ok: true,
    ticker,
    price: q.price,
    currency: q.currency,
    asOf,
    source: q.source,
    display,
    trailingEps: q.trailingEps,
    trailingPE: q.trailingPE,
    marketCap: q.marketCap,
    enterpriseValue: q.enterpriseValue,
    trailingEvToEbitda: q.trailingEvToEbitda,
    priceToBook: q.priceToBook,
    bookValue: q.bookValue,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    fundamentalsDisplay,
  };
}

function compactMoney(n: number, currency: string): string {
  // Indian context → use Cr (10 mn) lakhs convention; otherwise SI (B/M).
  if (currency === "INR") {
    if (n >= 1e7) return `${(n / 1e7).toFixed(1)} cr`;
    if (n >= 1e5) return `${(n / 1e5).toFixed(1)} lakh`;
    return formatPrice(n);
  }
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
  return formatPrice(n);
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

// --- Source 1: Yahoo Finance v7 /quote JSON ------------------------------
//
// Returns price + fundamentals (EPS, P/E, market cap, 52w range) in one
// call. Multiple symbols per call are supported but we use one at a time so
// a 404 on a bad suffix doesn't poison the others.

interface YahooQuoteShape {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      currency?: string;
      trailingPE?: number;
      epsTrailingTwelveMonths?: number;
      marketCap?: number;
      priceToBook?: number;
      bookValue?: number;
      fiftyTwoWeekHigh?: number;
      fiftyTwoWeekLow?: number;
    }>;
    error?: unknown;
  };
}

// Yahoo v10 quoteSummary — returns enterpriseValue + EV/EBITDA which v7
// doesn't carry. The endpoint sometimes 401s without a session cookie; the
// caller treats null as "fall back gracefully" so an unverified EV/EBITDA
// is simply left blank rather than fabricated.
interface YahooQuoteSummaryShape {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: {
        enterpriseValue?: { raw?: number } | number | null;
        enterpriseToEbitda?: { raw?: number } | number | null;
      };
      summaryDetail?: {
        marketCap?: { raw?: number } | number | null;
        priceToBook?: { raw?: number } | number | null;
        trailingPE?: { raw?: number } | number | null;
      };
    }>;
    error?: unknown;
  };
}

function unwrapRaw(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && "raw" in v) {
    const r = (v as { raw?: unknown }).raw;
    if (typeof r === "number" && Number.isFinite(r)) return r;
  }
  return undefined;
}

async function tryYahooQuoteSummary(
  sym: string,
  signal: AbortSignal,
): Promise<Pick<RawQuote, "enterpriseValue" | "trailingEvToEbitda"> | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    sym,
  )}?modules=defaultKeyStatistics,summaryDetail`;
  const body = await safeFetchText(url, signal, "application/json");
  if (!body) return null;
  let json: YahooQuoteSummaryShape;
  try {
    json = JSON.parse(body) as YahooQuoteSummaryShape;
  } catch {
    return null;
  }
  const row = json.quoteSummary?.result?.[0]?.defaultKeyStatistics;
  if (!row) return null;
  return {
    enterpriseValue: unwrapRaw(row.enterpriseValue),
    trailingEvToEbitda: unwrapRaw(row.enterpriseToEbitda),
  };
}

async function tryYahooQuoteJson(
  sym: string,
  signal: AbortSignal,
): Promise<RawQuote | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    sym,
  )}`;
  const body = await safeFetchText(url, signal, "application/json");
  if (!body) return null;
  let json: YahooQuoteShape;
  try {
    json = JSON.parse(body) as YahooQuoteShape;
  } catch {
    return null;
  }
  const row = json.quoteResponse?.result?.[0];
  const price =
    typeof row?.regularMarketPrice === "number" ? row.regularMarketPrice : null;
  const currency = typeof row?.currency === "string" ? row.currency : null;
  if (price == null || !currency) return null;
  // Best-effort EV + EV/EBITDA from v10 quoteSummary (may 401 — that's OK,
  // the cells will simply read 'not surfaced' instead of being fabricated).
  const summary = await tryYahooQuoteSummary(sym, signal);
  return {
    price,
    currency,
    source: `Yahoo Finance · ${sym}`,
    trailingEps: numOrUndef(row?.epsTrailingTwelveMonths),
    trailingPE: numOrUndef(row?.trailingPE),
    marketCap: numOrUndef(row?.marketCap),
    enterpriseValue: summary?.enterpriseValue,
    trailingEvToEbitda: summary?.trailingEvToEbitda,
    priceToBook: numOrUndef(row?.priceToBook),
    bookValue: numOrUndef(row?.bookValue),
    fiftyTwoWeekHigh: numOrUndef(row?.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: numOrUndef(row?.fiftyTwoWeekLow),
  };
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// --- Source 2: Yahoo Finance v8 chart JSON --------------------------------

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
