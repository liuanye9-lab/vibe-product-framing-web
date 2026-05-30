export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'vibe_decision_theme';

export function getTheme(): ThemeMode {
  try {
    return (localStorage.getItem(KEY) as ThemeMode) || 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // storage unavailable — degrade gracefully
  }
  applyTheme(mode);
}

export function applyTheme(mode: ThemeMode): void {
  if (mode === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
