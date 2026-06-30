import { useEffect, useState } from "react";
import {
  loadSavedMemos,
  subscribeSavedMemos,
  type SavedMemo,
} from "./savedMemos";
import {
  getMemoSyncStatus,
  subscribeMemoSyncStatus,
  type MemoSyncStatus,
} from "./memoSync";

// Reactive view of the saved-memo library. Re-renders the caller whenever the
// library changes — in this tab (save / delete) or another tab (storage
// event). Used by the command bar (count) and the library page (list).
export function useSavedMemos(): SavedMemo[] {
  const [memos, setMemos] = useState<SavedMemo[]>(() => loadSavedMemos());
  useEffect(
    () => subscribeSavedMemos(() => setMemos(loadSavedMemos())),
    [],
  );
  return memos;
}

// Reactive cross-device sync status — "synced" once the library is mirrored to
// the server for the signed-in user, otherwise "local".
export function useMemoSyncStatus(): MemoSyncStatus {
  const [s, setS] = useState<MemoSyncStatus>(() => getMemoSyncStatus());
  useEffect(
    () => subscribeMemoSyncStatus(() => setS(getMemoSyncStatus())),
    [],
  );
  return s;
}
