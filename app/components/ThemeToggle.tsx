'use client';

import { useState, useEffect } from 'react';

// ponytail: inline client component, no hook file
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    html.classList.toggle('dark', !isDark);
    html.classList.toggle('light', isDark);
    localStorage.setItem('thinktwice-theme', isDark ? 'light' : 'dark');
    setDark(!isDark);
  };

  return (
    <button
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-lg leading-none transition shadow-lg flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
