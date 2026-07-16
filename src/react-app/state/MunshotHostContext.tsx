import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sdk, type DashboardHostContext } from "../lib/sdk";
import type {
  DashboardSnapshot,
  MunshotHostContextData,
} from "../lib/munshotSdk";

// Munshot host-context provider. Reads from the SINGLE module-scoped SDK
// client (see ../lib/sdk.ts) — it does NOT construct its own client, signal
// readiness, or block on a context request; the shipped SDK auto-completes the
// handshake and this provider just re-syncs on every host message. It maps the
// SDK's { session, market, app } context onto the app-facing MunshotHost
// ContextData shape and registers the mandatory dashboard.capture.snapshot
// request handler. Standalone (no SDK global) → host stays null; app renders.

export type MunshotConnectionMode =
  | "connecting"
  | "connected"
  | "standalone"
  | "error";

interface MunshotHostContextValue {
  host: MunshotHostContextData | null;
  mode: MunshotConnectionMode;
  isEmbedded: boolean;
  // Register the function the snapshot handler reads. Consumers call this from
  // an effect so the latest live dashboard state is always captured. Pass null
  // to clear.
  setSnapshotSource: (fn: (() => DashboardSnapshot) | null) => void;
  // Publish a namespaced telemetry / interaction event to the host (no-op in
  // standalone mode).
  publish: (topic: string, payload?: unknown) => void;
}

const Ctx = createContext<MunshotHostContextValue | null>(null);

// Map the SDK's host context onto the app-facing shape existing consumers read.
function mapContext(
  ctx: DashboardHostContext | null,
): MunshotHostContextData | null {
  if (!ctx) return null;
  const s = ctx.session;
  const m = ctx.market;
  return {
    user: s
      ? {
          id: s.email ?? undefined,
          name: s.userName ?? undefined,
          email: s.email ?? undefined,
        }
      : null,
    org: s ? { id: s.orgId ?? undefined, name: s.orgName ?? undefined } : null,
    ticker: m?.selectedTicker ?? null,
    company: m?.selectedTickerCompany ?? null,
    jwt: s?.token ?? null,
    filters: null,
    navigation: ctx.app
      ? ({ route: ctx.app.route, query: ctx.app.query } as Record<
          string,
          unknown
        >)
      : null,
    raw: ctx,
  };
}

function computeMode(): MunshotConnectionMode {
  // Never call the SDK ready-signal — the shipped client owns the handshake.
  // Derive status from cached context / channel instead (cosmetic only).
  if (sdk.getContext()) return "connected";
  if (sdk.getChannelId()) return "connecting";
  return "standalone";
}

export function MunshotHostProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<MunshotHostContextData | null>(() =>
    mapContext(sdk.getContext()),
  );
  const [mode, setMode] = useState<MunshotConnectionMode>(() => computeMode());
  const snapshotSourceRef = useRef<(() => DashboardSnapshot) | null>(null);

  useEffect(() => {
    const sync = (): void => {
      setHost(mapContext(sdk.getContext()));
      setMode(computeMode());
    };

    // Apply already-cached context (host:init may have arrived before mount),
    // then re-sync on every host message via the synchronous getContext().
    sync();
    const unsubMessage = sdk.onMessage(sync);

    // Mandatory handler — the host may capture live state at any point.
    const unsubRequest = sdk.onRequest("dashboard.capture.snapshot", () => {
      const source = snapshotSourceRef.current;
      return source ? source() : { context: {}, selection: null, data: {} };
    });

    return () => {
      // Only remove OUR subscriptions — never destroy the shared client.
      unsubMessage();
      unsubRequest();
    };
  }, []);

  const setSnapshotSource = useCallback(
    (fn: (() => DashboardSnapshot) | null) => {
      snapshotSourceRef.current = fn;
    },
    [],
  );

  const publish = useCallback((topic: string, payload?: unknown) => {
    sdk.publish(topic, payload);
  }, []);

  const value = useMemo<MunshotHostContextValue>(
    () => ({
      host,
      mode,
      isEmbedded: mode === "connected",
      setSnapshotSource,
      publish,
    }),
    [host, mode, setSnapshotSource, publish],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMunshotHost(): MunshotHostContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useMunshotHost must be used inside <MunshotHostProvider>");
  }
  return ctx;
}
