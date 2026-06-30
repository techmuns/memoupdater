import { useEffect, useState } from "react";
import {
  loadSavedMemos,
  subscribeSavedMemos,
  type SavedMemo,
} from "./savedMemos";

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
