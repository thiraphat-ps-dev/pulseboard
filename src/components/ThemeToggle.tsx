import { useEffect, useState } from 'react';
import { Button } from 'thira-ui';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem('pb-theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

// Apply before React renders to avoid a flash
const initial = stored();
if (initial) document.documentElement.dataset.theme = initial;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('pb-theme', next);
    } catch {
      // private mode: fine, it just won't persist
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
      <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
    </Button>
  );
}
