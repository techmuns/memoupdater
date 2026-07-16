// Shared Munshot host-integration types.
//
// The live Munshot Dashboard SDK client is created ONCE, at module load, in
// `./sdk.ts` (the shipped adapter). This module now only holds the app-facing
// shapes: the normalized host context the provider exposes, and the snapshot
// contract the host can request. No client is constructed here — a second
// client would race the SDK handshake.

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
