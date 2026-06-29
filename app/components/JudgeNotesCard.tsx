'use client';

import MarkdownContent from '@/app/components/MarkdownContent';
import { stripEvaluationMarkers } from '@/lib/verdict-utils';
import { translate as t } from '@/lib/translations';

interface JudgeNotesCardProps {
  text: string;
  isStreaming: boolean;
  decision: 'continue' | 'verdict' | null;
  lang: string;
}

export default function JudgeNotesCard({ text, isStreaming, decision, lang }: JudgeNotesCardProps) {
  if (!text && !isStreaming) return null;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 to-zinc-50 dark:to-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/15">
        <span className="text-sm">📝</span>
        <span className="font-semibold text-indigo-300 text-xs uppercase tracking-widest">
          {t("Judge's Notes", lang)}
        </span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-indigo-400">
            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
            {t('Evaluating…', lang)}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        {!text && isStreaming && (
          <p className="text-xs text-zinc-500 italic">{t('Judge is reviewing all responses…', lang)}</p>
        )}
        {text && (
          <MarkdownContent content={stripEvaluationMarkers(text)} className="text-xs [&_p]:text-xs [&_p]:text-zinc-500 dark:[&_p]:text-zinc-400 [&_strong]:text-zinc-400 dark:[&_strong]:text-zinc-300" />
        )}
      </div>
      {decision === 'continue' && !isStreaming && (
        <div className="px-4 py-2 border-t border-indigo-500/15 bg-indigo-500/5">
          <p className="text-[10px] text-indigo-400 font-medium">
            → {t('Continuing to next round', lang)}
          </p>
        </div>
      )}
    </div>
  );
}
