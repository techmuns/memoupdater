// Defensive adapter around the Munshot Dashboard SDK.
//
// The SDK ships as a minified UMD script that puts a NAMESPACE on
// `window.MunshotDashboardSDK` — NOT a ready client. You build the client with
// a factory (`createDashboardClientSdk` / `createClient`). Method names can
// vary across SDK builds, so every call here probes sensible alternatives and
// degrades silently. When no SDK global is present (local dev, tests) the
// factory returns null and the app runs in "standalone" mode — no crash.
//
// This module is pure (no React) so it stays easy to reason about and reuse.

export interface MunshotClientOptions {
  dashboardId: string;
  dashboardName: string;
}

// Normalized host context the app consumes. Everything is optional/nullable
// because the host shape varies and may be absent in standalone mode.
export interface MunshotHostContextData {
  user: { id?: string; name?: string; email?: string } | null;
  org: { id?: string; name?: string } | null;
  ticker: string | null;
  company: string | null;
  // Host-issued JWT for authenticated datasource calls. NEVER persisted.
  jwt: string | null;
  filters: Record<string, unknown> | null;
  navigation: Record<string, unknown> | null;
  raw: unknown;
}

export interface DashboardSnapshot {
  context: Record<string, unknown>;
  selection: unknown;
  data: Record<string, unknown>;
}

type AnyFn = (...args: unknown[]) => unknown;

// A normalized client. Each method is a no-op-safe wrapper over whatever the
// underlying SDK build actually exposes.
export interface MunshotClient {
  initialize: () => Promise<void>;
  registerMetadata: (meta: Record<string, unknown>) => void;
  signalReady: () => void;
  requestContext: () => Promise<MunshotHostContextData | null>;
  onContext: (cb: (ctx: MunshotHostContextData) => void) => () => void;
  onRequest: (topic: string, handler: (payload: unknown) => unknown) => void;
  publish: (topic: string, payload?: unknown) => void;
  onError: (cb: (err: unknown) => void) => void;
  onDisconnect: (cb: () => void) => void;
  disconnect: () => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Find the first method on `obj` whose name matches, bound to `obj`.
function pickFn(
  obj: Record<string, unknown> | null,
  names: string[],
): AnyFn | undefined {
  if (!obj) return undefined;
  for (const name of names) {
    const candidate = obj[name];
    if (typeof candidate === "function") {
      return (candidate as AnyFn).bind(obj);
    }
  }
  return undefined;
}

function getSdkNamespace(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { MunshotDashboardSDK?: unknown };
  return asRecord(w.MunshotDashboardSDK);
}

// Pull a JWT/token out of whatever the host nests it under.
function extractJwt(ctx: Record<string, unknown>): string | null {
  const session = asRecord(ctx.session) ?? asRecord(ctx.auth);
  return (
    str(ctx.jwt) ??
    str(ctx.token) ??
    str(ctx.accessToken) ??
    (session
      ? str(session.jwt) ??
        str(session.token) ??
        str(session.accessToken)
      : null)
  );
}

// Best-effort mapping of an arbitrary host-context payload onto our shape.
export function normalizeHostContext(raw: unknown): MunshotHostContextData {
  const ctx = asRecord(raw) ?? {};
  const userRec = asRecord(ctx.user);
  const orgRec = asRecord(ctx.org) ?? asRecord(ctx.organization);
  const tickerRec = asRecord(ctx.ticker);
  return {
    user: userRec
      ? {
          id: str(userRec.id) ?? undefined,
          name: str(userRec.name) ?? str(userRec.fullName) ?? undefined,
          email: str(userRec.email) ?? undefined,
        }
      : null,
    org: orgRec
      ? {
          id: str(orgRec.id) ?? undefined,
          name: str(orgRec.name) ?? undefined,
        }
      : null,
    ticker:
      str(ctx.ticker) ??
      str(ctx.symbol) ??
      str(ctx.selectedTicker) ??
      (tickerRec ? str(tickerRec.symbol) ?? str(tickerRec.ticker) : null),
    company:
      str(ctx.company) ??
      str(ctx.companyName) ??
      (tickerRec ? str(tickerRec.company) ?? str(tickerRec.name) : null),
    jwt: extractJwt(ctx),
    filters: asRecord(ctx.filters),
    navigation: asRecord(ctx.navigation),
    raw,
  };
}

// Build a normalized client, or null when there's no usable SDK global.
export function createMunshotClient(
  opts: MunshotClientOptions,
): MunshotClient | null {
  const lib = getSdkNamespace();
  if (!lib) return null;
  const factory = pickFn(lib, ["createDashboardClientSdk", "createClient"]);
  if (!factory) return null;

  let rawClient: unknown;
  try {
    rawClient = factory({
      dashboardId: opts.dashboardId,
      dashboardName: opts.dashboardName,
    });
  } catch {
    return null;
  }
  const client = asRecord(rawClient);
  if (!client) return null;

  const initFn = pickFn(client, ["initialize", "init", "connect", "start"]);
  const metaFn = pickFn(client, [
    "registerMetadata",
    "setMetadata",
    "register",
  ]);
  const readyFn = pickFn(client, ["signalReady", "ready", "setReady"]);
  const reqCtxFn = pickFn(client, [
    "requestContext",
    "getContext",
    "getHostContext",
    "fetchContext",
    "requestHostContext",
  ]);
  const onContextFn = pickFn(client, [
    "onContext",
    "onContextUpdate",
    "onHostContext",
    "subscribeContext",
  ]);
  const subscribeFn = pickFn(client, ["subscribe", "on", "addListener"]);
  const onRequestFn = pickFn(client, ["onRequest", "handleRequest", "respond"]);
  const publishFn = pickFn(client, ["publish", "emit", "send", "broadcast"]);
  const onErrorFn = pickFn(client, ["onError"]);
  const onDisconnectFn = pickFn(client, ["onDisconnect", "onClose"]);
  const disconnectFn = pickFn(client, ["disconnect", "destroy", "close"]);

  const subscribeToTopic = (topic: string, cb: (p: unknown) => void): void => {
    if (subscribeFn) {
      try {
        subscribeFn(topic, cb);
      } catch {
        /* ignore */
      }
    }
  };

  return {
    async initialize() {
      if (!initFn) return;
      try {
        await initFn();
      } catch {
        /* a non-fatal init failure degrades to standalone upstream */
      }
    },
    registerMetadata(meta) {
      try {
        metaFn?.(meta);
      } catch {
        /* ignore */
      }
    },
    signalReady() {
      try {
        readyFn?.();
      } catch {
        /* ignore */
      }
    },
    async requestContext() {
      if (!reqCtxFn) return null;
      try {
        const result = await reqCtxFn();
        return normalizeHostContext(result);
      } catch {
        return null;
      }
    },
    onContext(cb) {
      const handler = (payload: unknown): void =>
        cb(normalizeHostContext(payload));
      let unsub: (() => void) | undefined;
      if (onContextFn) {
        try {
          const maybe = onContextFn(handler);
          if (typeof maybe === "function") unsub = maybe as () => void;
        } catch {
          /* ignore */
        }
      } else {
        // Fall back to pub/sub on the conventional host-context topics.
        subscribeToTopic("host.context.update", handler);
        subscribeToTopic("dashboard.context", handler);
      }
      return () => {
        try {
          unsub?.();
        } catch {
          /* ignore */
        }
      };
    },
    onRequest(topic, handler) {
      try {
        onRequestFn?.(topic, handler);
      } catch {
        /* ignore */
      }
    },
    publish(topic, payload) {
      try {
        publishFn?.(topic, payload);
      } catch {
        /* ignore */
      }
    },
    onError(cb) {
      try {
        if (onErrorFn) onErrorFn(cb);
        else subscribeToTopic("dashboard.error", cb);
      } catch {
        /* ignore */
      }
    },
    onDisconnect(cb) {
      try {
        if (onDisconnectFn) onDisconnectFn(cb);
        else subscribeToTopic("host.disconnect", cb);
      } catch {
        /* ignore */
      }
    },
    disconnect() {
      try {
        disconnectFn?.();
      } catch {
        /* ignore */
      }
    },
  };
}
