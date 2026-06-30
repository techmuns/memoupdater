import { api } from "./api";
import {
  loadSavedMemos,
  replaceAllSavedMemos,
  setRemoteSink,
  type SavedMemo,
} from "./savedMemos";

// Cross-device sync orchestration for the saved-memo library.
//
// localStorage stays the reactive cache the UI reads (synchronous, offline).
// When a host user identity is available we mirror that cache to the KV-backed
// server and pull the server's set on startup, so the same memos appear on
// every device the analyst signs in from. With no identity (standalone / local
// dev) or when the server has no KV binding, this stays dormant and the app is
// local-only — exactly today's behaviour.

export type MemoSyncStatus = "local" | "synced";

let currentUserId: string | null = null;
let status: MemoSyncStatus = "local";
const statusListeners = new Set<() => void>();

function setStatus(next: MemoSyncStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l());
}

export function getMemoSyncStatus(): MemoSyncStatus {
  return status;
}

export function subscribeMemoSyncStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

// Turn on sync for a host user. Idempotent for the same id. Wires the local
// store's remote sink (so future saves/deletes push to the server) and runs a
// one-time reconcile.
export async function enableMemoSync(userId: string): Promise<void> {
  if (currentUserId === userId) return;
  currentUserId = userId;
  setRemoteSink({
    onUpsert: (memo) => {
      if (currentUserId) void api.memoPut(currentUserId, memo.id, memo).catch(() => {});
    },
    onDelete: (id) => {
      if (currentUserId) void api.memoDelete(currentUserId, id).catch(() => {});
    },
  });
  await reconcile();
}

export function disableMemoSync(): void {
  currentUserId = null;
  setRemoteSink(null);
  setStatus("local");
}

// Merge local and server libraries once, then make the server canonical.
// Local-only entries (saved before sync, or while offline) are uploaded so
// nothing is lost; after that the union becomes the local cache.
async function reconcile(): Promise<void> {
  const userId = currentUserId;
  if (!userId) return;

  let remote: { synced: boolean; memos: unknown[] };
  try {
    remote = await api.memosList(userId);
  } catch {
    // Offline or server error — keep the local cache and stay "local". A later
    // save will retry the push; a reload will retry the pull.
    return;
  }

  if (!remote.synced) {
    // Server has no KV binding configured — fall back to local-only.
    disableMemoSync();
    return;
  }

  const remoteList = remote.memos as SavedMemo[];
  const remoteIds = new Set(remoteList.map((m) => m.id));
  const localOnly = loadSavedMemos().filter((m) => !remoteIds.has(m.id));

  // Upload anything the server doesn't have yet.
  await Promise.all(
    localOnly.map((m) => api.memoPut(userId, m.id, m).catch(() => {})),
  );

  // Server set + freshly-uploaded local-only = the reconciled library.
  replaceAllSavedMemos([...remoteList, ...localOnly]);
  setStatus("synced");
}
