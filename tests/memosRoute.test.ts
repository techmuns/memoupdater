import { describe, expect, it } from "vitest";
import {
  handleMemoDelete,
  handleMemoPut,
  handleMemosList,
} from "../src/worker/memos/route";

// Unit tests for the KV-backed memo endpoints, exercised with a fake KV and a
// minimal fake Hono context (the handlers only touch env.MEMOS, req.header,
// req.param, req.json, and c.json). This covers the logic that can't be run
// through the app without a provisioned namespace + deploy.

function makeKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    put: async (k: string, v: string) => void store.set(k, v),
  };
}

interface CtxOpts {
  env: { MEMOS?: unknown };
  user?: string;
  id?: string;
  body?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(opts: CtxOpts): any {
  return {
    env: opts.env,
    req: {
      header: (name: string) =>
        name === "X-Munshot-User" ? opts.user : undefined,
      param: (name: string) => (name === "id" ? opts.id : undefined),
      json: async () => opts.body,
    },
    json: (obj: unknown, status = 200) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { "content-type": "application/json" },
      }),
  };
}

const memo = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Memo ${id}`,
  ...extra,
});

describe("memos route", () => {
  it("reports synced:false when KV is not bound", async () => {
    const res = await handleMemosList(makeCtx({ env: {}, user: "u1" }));
    const body = await res.json();
    expect(body).toEqual({ synced: false, memos: [] });
  });

  it("reports synced:false when no user identity header", async () => {
    const res = await handleMemosList(makeCtx({ env: { MEMOS: makeKV() } }));
    const body = await res.json();
    expect(body.synced).toBe(false);
  });

  it("puts a memo then lists it back for the user", async () => {
    const MEMOS = makeKV();
    await handleMemoPut(
      makeCtx({ env: { MEMOS }, user: "u1", id: "m1", body: memo("m1") }),
    );
    const res = await handleMemosList(makeCtx({ env: { MEMOS }, user: "u1" }));
    const body = await res.json();
    expect(body.synced).toBe(true);
    expect(body.memos).toHaveLength(1);
    expect(body.memos[0].id).toBe("m1");
  });

  it("scopes libraries per user", async () => {
    const MEMOS = makeKV();
    await handleMemoPut(makeCtx({ env: { MEMOS }, user: "u1", id: "m1", body: memo("m1") }));
    const res = await handleMemosList(makeCtx({ env: { MEMOS }, user: "u2" }));
    const body = await res.json();
    expect(body.memos).toHaveLength(0);
  });

  it("upserts (no duplicates) on repeated put of the same id", async () => {
    const MEMOS = makeKV();
    await handleMemoPut(makeCtx({ env: { MEMOS }, user: "u1", id: "m1", body: memo("m1", { v: 1 }) }));
    await handleMemoPut(makeCtx({ env: { MEMOS }, user: "u1", id: "m1", body: memo("m1", { v: 2 }) }));
    const res = await handleMemosList(makeCtx({ env: { MEMOS }, user: "u1" }));
    const body = await res.json();
    expect(body.memos).toHaveLength(1);
    expect(body.memos[0].v).toBe(2);
  });

  it("rejects a body whose id doesn't match the route param", async () => {
    const res = await handleMemoPut(
      makeCtx({ env: { MEMOS: makeKV() }, user: "u1", id: "m1", body: memo("DIFFERENT") }),
    );
    expect(res.status).toBe(400);
  });

  it("401s a put with no identity", async () => {
    const res = await handleMemoPut(
      makeCtx({ env: { MEMOS: makeKV() }, id: "m1", body: memo("m1") }),
    );
    expect(res.status).toBe(401);
  });

  it("deletes a memo", async () => {
    const MEMOS = makeKV();
    await handleMemoPut(makeCtx({ env: { MEMOS }, user: "u1", id: "m1", body: memo("m1") }));
    await handleMemoDelete(makeCtx({ env: { MEMOS }, user: "u1", id: "m1" }));
    const res = await handleMemosList(makeCtx({ env: { MEMOS }, user: "u1" }));
    const body = await res.json();
    expect(body.memos).toHaveLength(0);
  });
});
