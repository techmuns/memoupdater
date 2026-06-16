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
import {
  createMunshotClient,
  type DashboardSnapshot,
  type MunshotClient,
  type MunshotHostContextData,
} from "../lib/munshotSdk";

// Munshot SDK host-context provider. Runs the full required lifecycle
// (initialize → register metadata → signal ready → request initial context →
// subscribe to updates → handle disconnect/error) and registers the mandatory
// `dashboard.capture.snapshot` request handler. When no SDK global is present
// (local dev / tests) it runs in "standalone" mode — the app renders normally
// with no host context, never crashing.

const DASHBOARD_ID = "memo-updater";
const DASHBOARD_NAME = "Memo Updater";

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

export function MunshotHostProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<MunshotHostContextData | null>(null);
  const [mode, setMode] = useState<MunshotConnectionMode>("connecting");
  const clientRef = useRef<MunshotClient | null>(null);
  const snapshotSourceRef = useRef<(() => DashboardSnapshot) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createMunshotClient({
      dashboardId: DASHBOARD_ID,
      dashboardName: DASHBOARD_NAME,
    });

    // No SDK global → standalone. Defer the state set out of the effect body.
    if (!client) {
      queueMicrotask(() => {
        if (!cancelled) setMode("standalone");
      });
      return () => {
        cancelled = true;
      };
    }

    clientRef.current = client;

    // REQUIRED handler — registered up front so the host can capture state at
    // any point. Reads the latest snapshot source via the ref.
    client.onRequest("dashboard.capture.snapshot", () => {
      const source = snapshotSourceRef.current;
      return source ? source() : { context: {}, selection: null, data: {} };
    });

    client.onError(() => {
      if (!cancelled) setMode("error");
    });
    client.onDisconnect(() => {
      if (!cancelled) setMode("standalone");
    });

    const unsubContext = client.onContext((ctx) => {
      if (!cancelled) setHost(ctx);
    });

    void (async () => {
      try {
        await client.initialize();
        client.registerMetadata({
          dashboardId: DASHBOARD_ID,
          dashboardName: DASHBOARD_NAME,
          kind: "follow-up-memo-workbench",
        });
        client.signalReady();
        const initial = await client.requestContext();
        if (cancelled) return;
        if (initial) setHost(initial);
        setMode("connected");
      } catch {
        if (!cancelled) setMode("standalone");
      }
    })();

    return () => {
      cancelled = true;
      try {
        unsubContext();
      } catch {
        /* ignore */
      }
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const setSnapshotSource = useCallback(
    (fn: (() => DashboardSnapshot) | null) => {
      snapshotSourceRef.current = fn;
    },
    [],
  );

  const publish = useCallback((topic: string, payload?: unknown) => {
    clientRef.current?.publish(topic, payload);
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
