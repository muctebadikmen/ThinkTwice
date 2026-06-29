'use client';

import MarkdownContent from '@/app/components/MarkdownContent';
import { translate as t } from '@/lib/translations';

interface AgentPanelProps {
  option: string;
  index: number;
  roundNumber: number;
  responseText: string;
  isActive: boolean;
  isDone: boolean;
  expertLabel?: string;
  lang: string;
}

const COLORS = [
  { border: 'border-blue-500', badge: 'bg-blue-500', header: 'bg-blue-500/10', dot: 'bg-blue-400' },
  { border: 'border-emerald-500', badge: 'bg-emerald-500', header: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  { border: 'border-violet-500', badge: 'bg-violet-500', header: 'bg-violet-500/10', dot: 'bg-violet-400' },
  { border: 'border-orange-500', badge: 'bg-orange-500', header: 'bg-orange-500/10', dot: 'bg-orange-400' },
];

function StreamingDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export default function AgentPanel({
  option, index, roundNumber, responseText, isActive, isDone, expertLabel, lang,
}: AgentPanelProps) {
  const color = COLORS[index % COLORS.length];

  const statusLabel = isActive
    ? t('Searching the web and forming response…', lang)
    : isDone
    ? t('Response submitted', lang)
    : t("Waiting for judge's question…", lang);

  return (
    <div className={`flex flex-col rounded-2xl border ${color.border} bg-zinc-50 dark:bg-zinc-900 overflow-hidden`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${color.header}`}>
        <span className={`text-xs font-bold text-zinc-950 dark:text-white px-2 py-0.5 rounded-full ${color.badge}`}>
          {t('Advocate', lang)} {index + 1}
        </span>
        <span className="font-semibold text-zinc-950 dark:text-white truncate">{option}</span>
        <StreamingDot active={isActive} />
        {expertLabel && (
          <span className="ml-auto text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]" title={expertLabel}>
            {expertLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className={`w-2 h-2 rounded-full ${isActive ? `${color.dot} animate-pulse` : isDone ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
        <span className="text-xs text-zinc-600 dark:text-zinc-400">{statusLabel}</span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-h-[50vh]">
        {!responseText && !isActive && !isDone && (
          <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">{t("Waiting for judge's question…", lang)}</p>
        )}
        {!responseText && isDone && (
          <p className="text-xs text-zinc-500 italic">{t('Response was not captured for this round.', lang)}</p>
        )}
        {responseText && (
          <MarkdownContent content={responseText} enableCitations />
        )}
        {isActive && !responseText && (
          <p className="text-xs text-zinc-500 italic">{t('Searching the web and forming response…', lang)}</p>
        )}
      </div>
    </div>
  );
}
