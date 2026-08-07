import { useEffect, useState } from 'react';
import type { Theme } from '@gravity-ui/uikit';

const STORAGE_KEY = 'groundwork:theme';
const KNOWN_THEMES: Theme[] = ['system', 'light', 'dark', 'light-hc', 'dark-hc'];

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && KNOWN_THEMES.includes(stored as Theme) ? (stored as Theme) : 'system';
  } catch {
    return 'system';
  }
}

/** Tracks the Gravity UI theme and persists it across reloads via localStorage. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (e.g. private browsing) — theme still works for this session.
    }
  }, [theme]);

  return [theme, setTheme];
}
