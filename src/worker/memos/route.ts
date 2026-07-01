import type { Context } from "hono";

// Cross-device saved-memo library, backed by Workers KV. Each user's library
// is one JSON document keyed by their host-provided identity:
//   memos:<userId>  ->  [ {memo}, {memo}, ... ]
//
// Identity comes from the X-Munshot-User header (the host iframe's user id).
// The worker can't independently verify it — this matches the app's existing
// trust model — so the endpoints are deliberately cheap and capped to bound
// any abuse. When the MEMOS binding is absent (not provisioned) every endpoint
// reports synced:false and the client falls back to local-only storage.

const KEY_PREFIX = "memos:";
const MAX_MEMOS = 50;
// A memo now carries its comprehensive research report (for cross-device Q&A),
// so allow a larger per-memo document.
const MAX_MEMO_BYTES = 1_500 * 1024;
const MAX_USER_ID_LEN = 200;

interface StoredMemo {
  id: string;
  [key: string]: unknown;
}

function userKey(c: Context<{ Bindings: Env }>): string | null {
  const raw = c.req.header("X-Munshot-User");
  if (!raw) return null;
  // Restrict to a safe key charset and length; reject if nothing survives.
  const id = raw.trim().slice(0, MAX_USER_ID_LEN).replace(/[^a-zA-Z0-9_.@:-]/g, "_");
  return id ? `${KEY_PREFIX}${id}` : null;
}

async function readList(env: Env, key: string): Promise<StoredMemo[]> {
  const raw = await env.MEMOS!.get(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is StoredMemo =>
        !!m && typeof m === "object" && typeof (m as StoredMemo).id === "string",
    );
  } catch {
    return [];
  }
}

export async function handleMemosList(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  if (!c.env.MEMOS) return c.json({ synced: false, memos: [] });
  const key = userKey(c);
  if (!key) return c.json({ synced: false, memos: [] });
  const memos = await readList(c.env, key);
  return c.json({ synced: true, memos });
}

export async function handleMemoPut(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  if (!c.env.MEMOS) return c.json({ synced: false });
  const key = userKey(c);
  if (!key) return c.json({ error: "no_identity" }, 401);
  const id = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "bad_json" }, 400);
  }
  if (
    !body ||
    typeof body !== "object" ||
    (body as StoredMemo).id !== id
  ) {
    return c.json({ error: "id_mismatch" }, 400);
  }
  const memo = body as StoredMemo;
  if (JSON.stringify(memo).length > MAX_MEMO_BYTES) {
    return c.json({ error: "too_large" }, 413);
  }

  const list = await readList(c.env, key);
  const idx = list.findIndex((m) => m.id === id);
  if (idx >= 0) list[idx] = memo;
  else list.unshift(memo);
  await c.env.MEMOS.put(key, JSON.stringify(list.slice(0, MAX_MEMOS)));
  return c.json({ synced: true });
}

export async function handleMemoDelete(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  if (!c.env.MEMOS) return c.json({ synced: false });
  const key = userKey(c);
  if (!key) return c.json({ error: "no_identity" }, 401);
  const id = c.req.param("id");
  const list = await readList(c.env, key);
  const next = list.filter((m) => m.id !== id);
  if (next.length !== list.length) {
    await c.env.MEMOS.put(key, JSON.stringify(next));
  }
  return c.json({ synced: true });
}
