'use client';

import { useMemo } from 'react';
import MarkdownContent from '@/app/components/MarkdownContent';
import VerdictScorecard from '@/app/components/VerdictScorecard';
import { parseScorecard } from '@/lib/scorecard-parser';
import { translate as t } from '@/lib/translations';

interface VerdictCardProps {
  text: string;
  isStreaming: boolean;
  lang: string;
}

function StreamingCursor({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="inline-block w-0.5 h-4 bg-amber-400 animate-pulse ml-0.5 align-middle" />;
}

export default function VerdictCard({ text, isStreaming, lang }: VerdictCardProps) {
  if (!text && !isStreaming) return null;

  const scorecard = useMemo(() => {
    if (isStreaming || !text) return null;
    return parseScorecard(text);
  }, [text, isStreaming]);

  return (
    <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-950/40 to-zinc-50 dark:to-zinc-900 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border-b border-amber-500/20">
        <span className="text-lg">⚖️</span>
        <span className="font-bold text-amber-300 text-sm uppercase tracking-widest">
          {t("Judge's Verdict", lang)}
        </span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {t('Deliberating…', lang)}
          </span>
        )}
      </div>
      <div className="px-5 py-4">
        {!text && isStreaming && (
          <p className="text-sm text-zinc-500 italic">{t('Reading all arguments and forming verdict…', lang)}</p>
        )}
        {text && (
          <div>
            {scorecard && <VerdictScorecard scorecard={scorecard} />}
            <MarkdownContent content={text} />
            <StreamingCursor show={isStreaming} />
          </div>
        )}
      </div>
    </div>
  );
}
