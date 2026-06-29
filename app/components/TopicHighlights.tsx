'use client';

import { useState, useMemo } from 'react';
import { extractTopics, TopicComparison } from '@/lib/topic-extractor';

const COLORS = [
  { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
  { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { text: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/5' },
  { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5' },
];

interface TopicHighlightsProps {
  responses: string[];
  options: string[];
  isRoundComplete: boolean;
}

export default function TopicHighlights({
  responses,
  options,
  isRoundComplete,
}: TopicHighlightsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const topics = useMemo(() => {
    if (!isRoundComplete) return [];
    return extractTopics(responses, options);
  }, [responses, options, isRoundComplete]);

  if (!isRoundComplete || topics.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition"
      >
        <span className="text-xs">🔀</span>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          View topic comparison ({topics.length} topic{topics.length !== 1 ? 's' : ''})
        </span>
        <svg
          className={`w-3 h-3 text-zinc-500 ml-auto transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3 space-y-3">
            {topics.map((topic, tIdx) => (
              <TopicRow key={tIdx} topic={topic} options={options} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TopicRow({
  topic,
  options,
}: {
  topic: TopicComparison;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {topic.topic}
      </p>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${topic.positions.length}, 1fr)` }}
      >
        {topic.positions.map((pos, pIdx) => {
          const optionIdx = options.indexOf(pos.option);
          const color = COLORS[(optionIdx >= 0 ? optionIdx : pIdx) % COLORS.length];

          return (
            <div
              key={pIdx}
              className={`rounded-lg border ${color.border} ${color.bg} p-2.5`}
            >
              <p className={`text-[10px] font-bold ${color.text} mb-1 truncate`}>
                {pos.option}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                {pos.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
