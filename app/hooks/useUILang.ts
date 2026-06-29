'use client';

import { useState, useEffect } from 'react';

// ponytail: localStorage-backed UI language, separate from model output language
const STORAGE_KEY = 'thinktwice-ui-lang';

function getInitial(): string {
  if (typeof window === 'undefined') return 'en';
  return localStorage.getItem(STORAGE_KEY) || (typeof navigator !== 'undefined' && navigator.language?.startsWith('tr') ? 'tr' : 'en');
}

export function useUILang() {
  const [lang, setLang] = useState('en');

  useEffect(() => { setLang(getInitial()); }, []);

  const toggle = () => {
    const next = lang === 'en' ? 'tr' : 'en';
    localStorage.setItem(STORAGE_KEY, next);
    setLang(next);
  };

  return { uiLang: lang, toggleUILang: toggle };
}
