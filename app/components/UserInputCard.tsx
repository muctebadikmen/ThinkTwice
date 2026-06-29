'use client';

import { useState, useRef, useEffect } from 'react';
import { translate as t } from '@/lib/translations';

interface UserInputCardProps {
  question: string;
  roundNumber: number;
  onSubmit: (input: string) => void;
  isSubmitted: boolean;
  submittedAnswer?: string;
  lang: string;
}

export default function UserInputCard({
  question, roundNumber, onSubmit, isSubmitted, submittedAnswer, lang,
}: UserInputCardProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  void roundNumber;

  useEffect(() => {
    if (!isSubmitted && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isSubmitted]);

  const handleSubmit = () => {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);
    onSubmit(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isSubmitted) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-gradient-to-br from-green-950/20 to-zinc-50 dark:to-zinc-900 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border-b border-green-500/15">
          <span className="text-sm">\uD83D\uDCAC</span>
          <span className="font-semibold text-green-300 text-xs uppercase tracking-widest">
            {t('Your Clarification', lang)}
          </span>
          <span className="ml-auto text-[10px] text-green-400 font-medium">{t('Submitted', lang)}</span>
        </div>
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{t('Judge asked:', lang)}</span> {question}
          </p>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg px-3 py-2 leading-relaxed">
            {submittedAnswer}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-500/40 bg-gradient-to-br from-green-950/30 to-zinc-50 dark:to-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border-b border-green-500/20">
        <span className="text-sm">\uD83D\uDCAC</span>
        <span className="font-semibold text-green-300 text-xs uppercase tracking-widest">
          {t('Judge Needs Your Input', lang)}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {t('Debate paused', lang)}
        </span>
      </div>
      <div className="px-4 pt-3">
        <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">{question}</p>
      </div>
      <div className="px-4 py-3 space-y-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('Type your answer here...', lang)}
          rows={3}
          disabled={isSubmitting}
          className="w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-green-500/50 transition resize-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">
            {t('Press Cmd+Enter to submit', lang)}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-zinc-950 dark:text-white transition"
          >
            {isSubmitting ? t('Submitting…', lang) : t('Submit & Continue Debate', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
