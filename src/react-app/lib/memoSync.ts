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

// Why sync is in its current state — drives the UI's plain-English explanation
// so "THIS DEVICE" is never a silent mystery.
export type MemoSyncReason =
  | "ok" // synced to the server
  | "no_identity" // no sync id set and the host provided none
  | "server_unavailable" // reached the server but KV isn't configured/deployed
  | "offline" // couldn't reach the server (will retry on reload)
  | "idle"; // nothing to sync yet

let currentUserId: string | null = null;
let status: MemoSyncStatus = "local";
let reason: MemoSyncReason = "idle";
const statusListeners = new Set<() => void>();

function emit(next: MemoSyncStatus, nextReason: MemoSyncReason): void {
  const changed = status !== next || reason !== nextReason;
  status = next;
  reason = nextReason;
  if (changed) statusListeners.forEach((l) => l());
}

export function getMemoSyncStatus(): MemoSyncStatus {
  return status;
}

export function getMemoSyncReason(): MemoSyncReason {
  return reason;
}

export function subscribeMemoSyncStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

// Turn on sync for a given identity (host user id, or a manual sync id the user
// entered in Settings). Idempotent for the same id. Wires the local store's
// remote sink (so future saves/deletes push to the server) and reconciles.
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

export function disableMemoSync(reasonWhy: MemoSyncReason = "no_identity"): void {
  currentUserId = null;
  setRemoteSink(null);
  emit("local", reasonWhy);
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
    // Couldn't reach the server — keep the local cache. A save retries the
    // push; a reload retries the pull.
    emit("local", "offline");
    return;
  }

  if (!remote.synced) {
    // Reached the server but KV isn't configured/deployed. Stay local, but keep
    // the identity wired so a later reconcile (after deploy) can succeed.
    emit("local", "server_unavailable");
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
  emit("synced", "ok");
}
