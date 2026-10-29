// Kun / Tun rejimi. Tanlov shu qurilmada saqlanadi (localStorage), sahifa ochilishidan oldin index.html'dagi skript qo'llaydi.
import { useSyncExternalStore } from 'react';
import { getTelegramWebApp } from './telegram';

export type Theme = 'dark' | 'light';
const KEY = 'vb_theme_v1';
const COLORS: Record<Theme, string> = { dark: '#0B0F17', light: '#F3F5F9' };
const listeners = new Set<() => void>();

export const getTheme = (): Theme => {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', t === 'dark');
  root.classList.toggle('light', t === 'light');
  root.style.colorScheme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[t]);
  const tg = getTelegramWebApp();
  try {
    tg?.setHeaderColor?.(COLORS[t]);
    tg?.setBackgroundColor?.(COLORS[t]);
  } catch {
    /* ignore */
  }
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
  listeners.forEach(l => l());
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
    () => 'dark' as Theme
  );
  return [theme, setTheme];
}
