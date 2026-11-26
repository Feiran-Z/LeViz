import { useCallback, useEffect } from 'react';
import { useUiStore, type ThemePreference } from '../stores/uiStore';

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

/** Applies the preference to <html data-theme> and tracks the OS setting. */
export function useThemeEffect(): void {
  const preference = useUiStore((state) => state.themePreference);
  const setResolvedTheme = useUiStore((state) => state.setResolvedTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      document.documentElement.dataset['theme'] = resolved;
      setResolvedTheme(resolved);
    };
    apply();
    if (preference !== 'system') return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference, setResolvedTheme]);
}

export function useThemeToggle(): {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  cycle: () => void;
} {
  const preference = useUiStore((state) => state.themePreference);
  const resolved = useUiStore((state) => state.resolvedTheme);
  const setThemePreference = useUiStore((state) => state.setThemePreference);

  const cycle = useCallback(() => {
    const index = ORDER.indexOf(preference);
    const next = ORDER[(index + 1) % ORDER.length] ?? 'system';
    setThemePreference(next);
  }, [preference, setThemePreference]);

  return { preference, resolved, cycle };
}
