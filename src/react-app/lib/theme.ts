import { useEffect, useState } from "react";

// Light / dark theme for the dashboard. The default is dark (the "engine
// world"); the choice is persisted per-browser and applied as a data-theme
// attribute on <html>, which the CSS keys off (see index.css).

export type Theme = "light" | "dark";

const STORAGE_KEY = "memo-updater-theme";

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage unavailable — fall through to default */
  }
  return "dark";
}

export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

// Read + toggle the theme, persisting and applying it on change.
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures */
    }
  }, [theme]);
  return [theme, setTheme];
}
