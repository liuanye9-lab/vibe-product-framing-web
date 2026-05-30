import { useEffect, useState } from 'react';
import { getTheme, setTheme, type ThemeMode } from '../lib/theme';
import { Sun, Moon, Monitor } from 'lucide-react';

const MODES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: 'system', label: 'System', icon: Monitor },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(getTheme());
  }, []);

  const handle = (m: ThemeMode) => {
    setMode(m);
    setTheme(m);
  };

  return (
    <div className="vp-segmented">
      {MODES.map((m) => (
        <button
          key={m.key}
          className={`vp-segmented__item${mode === m.key ? ' vp-segmented__item--active' : ''}`}
          onClick={() => handle(m.key)}
          aria-label={m.label}
        >
          <m.icon size={13} />
        </button>
      ))}
    </div>
  );
}
