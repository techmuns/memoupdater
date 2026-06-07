import { useEffect, useState } from "react";

const STORAGE_KEY = "memo.llm.gate";

// Tab-scoped subscribers so multiple hook instances stay in sync without
// relying on the browser's `storage` event (which only fires cross-tab).
const subscribers = new Set<(value: string | null) => void>();

function readStorage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage may be unavailable (private mode, etc.).
  }
}

export function getLlmGateToken(): string | null {
  return readStorage();
}

export function setLlmGateToken(value: string | null): void {
  writeStorage(value);
  for (const subscriber of subscribers) subscriber(value);
}

export function useLlmGateToken(): [
  string | null,
  (value: string | null) => void,
] {
  const [token, setToken] = useState<string | null>(() => readStorage());

  useEffect(() => {
    subscribers.add(setToken);
    return () => {
      subscribers.delete(setToken);
    };
  }, []);

  return [token, setLlmGateToken];
}
