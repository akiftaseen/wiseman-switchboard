import { useLayoutEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const storageKey = 'switchboard-theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // The toggle still works for this visit if the browser blocks storage.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(initialTheme);
  const isDark = theme === 'dark';
  const next = isDark ? 'light' : 'dark';
  const label = isDark ? 'Light mode' : 'Dark mode';
  const Icon = isDark ? Sun : Moon;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme(next);

    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage is optional for the current page.
    }
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme}>
      <Icon size={17} aria-hidden="true" />
      {label}
    </button>
  );
}
