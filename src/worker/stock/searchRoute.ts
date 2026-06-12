// Company picker proxy. POST /api/stock/search forwards a free-text query to
// the upstream stock-search service (devde.muns.io/stock/search) using the
// MUNS_ACCESS_TOKEN secret as the bearer token, then normalizes the response
// into a flat StockSearchResult[] for the dashboard.
//
// Why a proxy at all: MUNS_ACCESS_TOKEN is a Worker secret and must NEVER
// reach the browser — same discipline as the LLM keys. The client only ever
// sees the bearer-less, normalized result set.
//
// Discipline:
// - user_index is a fixed constant (124) per product requirement; the client
//   cannot influence it.
// - 15s upstream timeout via the shared combineWithTimeout helper, with the
//   client's abort signal forwarded so a cancelled keystroke cancels the
//   in-flight fetch.
// - All failures return HTTP 200 with { ok:false, code, message } so the
//   client renders an inline hint instead of a thrown error (mirrors the LLM
//   endpoints' safe-failure contract).
// - NEVER logged: the token, the Authorization header, or the upstream body.
import type { Context } from "hono";
import type { StockSearchResponse } from "@shared/types";
import {
  extractStockSearchTotal,
  normalizeStockSearchResults,
} from "@shared/stockSearch";
import { combineWithTimeout } from "../llm/abort";

const UPSTREAM_URL = "https://devde.muns.io/stock/search";
const STATIC_USER_INDEX = 124;
const MAX_QUERY_CHARS = 80;
const MAX_BODY_BYTES = 4 * 1024;
const UPSTREAM_TIMEOUT_MS = 15_000;

export async function handleStockSearch(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  let bodyText: string;
  try {
    bodyText = await c.req.raw.text();
  } catch {
    return c.json(fail("invalid_request", "Request body was unreadable."));
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
  const rawQuery =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).query
      : undefined;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  if (query.length === 0) {
    return c.json(fail("invalid_request", "A non-empty query is required."));
  }

  const token = readMunsToken(c.env);
  if (!token) {
    return c.json(
      fail(
        "not_configured",
        "Company search is not configured. Set the MUNS_ACCESS_TOKEN secret on the Worker (wrangler secret put MUNS_ACCESS_TOKEN).",
      ),
    );
  }

  const boundedQuery = query.slice(0, MAX_QUERY_CHARS);
  const combined = combineWithTimeout(c.req.raw.signal, UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: boundedQuery,
        user_index: STATIC_USER_INDEX,
      }),
      signal: combined.signal,
    });
  } catch (err) {
    combined.clear();
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    console.log(
      JSON.stringify({
        event: "stock_search_fetch_fail",
        timeout: isTimeout,
      }),
    );
    return c.json(
      isTimeout
        ? fail("timeout", "Company search timed out. Try again.")
        : fail(
            "provider_error",
            "Could not reach the company search service.",
          ),
    );
  }
  combined.clear();

  if (!upstream.ok) {
    // Surface only the status code — never the upstream body, which could
    // echo the request and is outside our control.
    console.log(
      JSON.stringify({
        event: "stock_search_upstream_status",
        status: upstream.status,
      }),
    );
    return c.json(
      fail(
        "upstream_error",
        `Company search service returned HTTP ${upstream.status}.`,
      ),
    );
  }

  let raw: unknown;
  try {
    raw = await upstream.json();
  } catch {
    return c.json(
      fail("provider_error", "Company search returned an unreadable response."),
    );
  }

  const results = normalizeStockSearchResults(raw);
  const totalResults = extractStockSearchTotal(raw, results.length);
  console.log(
    JSON.stringify({
      event: "stock_search_ok",
      queryLen: boundedQuery.length,
      results: results.length,
    }),
  );
  const body: StockSearchResponse = {
    ok: true,
    query: boundedQuery,
    totalResults,
    results,
  };
  return c.json(body);
}

function fail(
  code: Extract<StockSearchResponse, { ok: false }>["code"],
  message: string,
): StockSearchResponse {
  return { ok: false, code, message };
}

function readMunsToken(env: Env): string | undefined {
  const value = (env as unknown as Record<string, unknown>).MUNS_ACCESS_TOKEN;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
