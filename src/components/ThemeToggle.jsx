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

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);

    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Storage is optional for the current page.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Dark mode"
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      <span>Dark mode</span>
    </button>
  );
}
