import { useEffect, useState } from "react";

// Manual cross-device sync identity. The library syncs per identity: enter the
// SAME id (e.g. your email) on every device and they share one library. This
// makes sync work even when the embedded host doesn't hand the app a user id.
//
// Trust note: the id is the KV key scope and the worker can't verify it, so
// treat it like a shared key — use something only you would (an email, or a
// long private phrase), not a guessable value.

const KEY = "memo.syncId";
const EVENT = "memo:sync-id-changed";

export function getSyncId(): string {
  try {
    return (localStorage.getItem(KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function setSyncId(value: string): void {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // storage unavailable — nothing to persist
  }
}

export function subscribeSyncId(cb: () => void): () => void {
  const handler = (): void => cb();
  const storageHandler = (e: StorageEvent): void => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

export function useSyncId(): string {
  const [id, setId] = useState<string>(() => getSyncId());
  useEffect(() => subscribeSyncId(() => setId(getSyncId())), []);
  return id;
}
