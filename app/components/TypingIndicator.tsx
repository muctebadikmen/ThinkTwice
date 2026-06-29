'use client';

import { DebatePhase } from '@/types/debate';
import { translate as t } from '@/lib/translations';

interface TypingIndicatorProps {
  phase: DebatePhase;
  currentRound: number;
  maxRounds: number;
  activeAgentCount: number;
  lang: string;
}

function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
      <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export default function TypingIndicator({
  phase, currentRound, maxRounds, activeAgentCount, lang,
}: TypingIndicatorProps) {
  if (phase === 'idle' || phase === 'complete') return null;

  const getMessage = (): { icon: string; text: string; color: string } => {
    switch (phase) {
      case 'judge_question':
        return {
          icon: '\uD83D\uDD0D',
          text: t('Judge is formulating question', lang).replace('{round}', String(currentRound)).replace('{max}', String(maxRounds)),
          color: 'text-cyan-400',
        };
      case 'advocate_response':
        return {
          icon: '\u2694\uFE0F',
          text: t('advocates researching', lang).replace('{count}', String(activeAgentCount)),
          color: 'text-blue-400',
        };
      case 'evaluation':
        return {
          icon: '\uD83D\uDCDD',
          text: t('Judge is evaluating round', lang).replace('{round}', String(currentRound)),
          color: 'text-indigo-400',
        };
      case 'user_input':
        return {
          icon: '\uD83D\uDCAC',
          text: t('Debate paused — waiting for your response', lang),
          color: 'text-green-400',
        };
      case 'verdict':
        return {
          icon: '\u2696\uFE0F',
          text: t('Judge is delivering the final verdict', lang),
          color: 'text-amber-400',
        };
      default:
        return { icon: '', text: '', color: '' };
    }
  };

  const { icon, text, color } = getMessage();
  if (!text) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-50 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50 shadow-lg">
        <span className="text-sm">{icon}</span>
        <span className={`text-xs font-medium ${color}`}>
          {text}
          <AnimatedDots />
        </span>
      </div>
    </div>
  );
}
