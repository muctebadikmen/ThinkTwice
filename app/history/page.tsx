'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedDebate } from '@/types/debate';
import { parseScorecard } from '@/lib/scorecard-parser';
import { extractWinner } from '@/lib/verdict-utils';
import { translate as t } from '@/lib/translations';
import { useUILang } from '@/app/hooks/useUILang';

function formatDate(timestamp: number, uiLang: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('Just now', uiLang);
  if (diffMins < 60) return `${diffMins}${t('m ago', uiLang)}`;
  if (diffHours < 24) return `${diffHours}${t('h ago', uiLang)}`;
  if (diffDays < 7) return `${diffDays}${t('d ago', uiLang)}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryInner />
    </Suspense>
  );
}

function HistoryInner() {
  const router = useRouter();
  const { uiLang, toggleUILang } = useUILang();
  const [debates, setDebates] = useState<SavedDebate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('decision-maker-debates') || '[]') as SavedDebate[];
      setDebates(saved);
    } catch {
      setDebates([]);
    }
    setLoaded(true);
  }, []);

  const deleteDebate = (id: string) => {
    const updated = debates.filter((d) => d.id !== id);
    setDebates(updated);
    localStorage.setItem('decision-maker-debates', JSON.stringify(updated));
  };

  const clearAll = () => {
    setDebates([]);
    localStorage.removeItem('decision-maker-debates');
  };

  const optionColors = [
    'text-blue-400',
    'text-emerald-400',
    'text-violet-400',
    'text-orange-400',
    'text-pink-400',
    'text-cyan-400',
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            >
              {t('Back', uiLang)}
            </button>
            <h1 className="text-2xl font-bold tracking-tight">{t('Past Debates', uiLang)}</h1>
            <p className="text-zinc-500 text-sm">
              {debates.length} {t('debatesSaved', uiLang)}{debates.length !== 1 ? 's' : ''} {t('saved locally', uiLang)}
            </p>
          </div>
          {debates.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-zinc-500 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-900/20"
            >
              {t('Clear all', uiLang)}
            </button>
          )}
        </div>

        {/* Empty state */}
        {loaded && debates.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="text-4xl">&#x1F4DC;</div>
            <p className="text-zinc-500 text-sm">{t('No debates yet. Start your first one!', uiLang)}</p>
            <button
              onClick={() => router.push(`/?uiLang=${encodeURIComponent(uiLang)}`)}
              className="px-5 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition"
            >
              {t('Start a debate', uiLang)}
            </button>
          </div>
        )}

        {/* Debate list */}
        <div className="space-y-3">
          {debates.map((debate) => {
            const winner = extractWinner(debate.verdict, parseScorecard(debate.verdict));

            return (
              <div
                key={debate.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-200 dark:hover:border-zinc-700 transition overflow-hidden group"
              >
                {/* Main card content */}
                <div className="px-5 py-4 space-y-3">
                  {/* Options as tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    {debate.options.map((opt, i) => (
                      <span
                        key={i}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 ${
                          winner && opt === winner ? 'ring-1 ring-amber-500/50 text-amber-300' : optionColors[i % optionColors.length]
                        }`}
                      >
                        {winner && opt === winner && (
                          <span className="mr-1">&#x1F451;</span>
                        )}
                        {opt}
                      </span>
                    ))}
                  </div>

                  {debate.prompt && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      &ldquo;{debate.prompt}&rdquo;
                    </p>
                  )}

                  {debate.experts && debate.experts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {debate.experts.map((e, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded"
                        >
                          {e.option}: {e.expert}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                    <span>{debate.rounds.length} {t('roundsLabel', uiLang)}{debate.rounds.length !== 1 ? 's' : ''}</span>
                    <span>&middot;</span>
                    <span>{debate.language}</span>
                    <span>&middot;</span>
                    <span>{debate.model}</span>
                    <span className="ml-auto">{formatDate(debate.createdAt, uiLang)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800/30 border-t border-zinc-200 dark:border-zinc-800/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteDebate(debate.id)}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition"
                  >
                    {t('Delete', uiLang)}
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/history/${debate.id}?uiLang=${encodeURIComponent(uiLang)}`);
                    }}
                    className="text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
                  >
                    {t('View full debate →', uiLang)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
