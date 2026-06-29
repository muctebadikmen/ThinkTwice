'use client';

import React, { useEffect, useState } from 'react';
import { Scorecard } from '@/lib/scorecard-parser';

const COLORS = [
  { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10' },
  { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  { bar: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10' },
];

interface VerdictScorecardProps {
  scorecard: Scorecard;
}

export default function VerdictScorecard({ scorecard }: VerdictScorecardProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  // Find overall winner (last category is usually "Overall")
  const overallIdx = scorecard.categories.length - 1;
  let winnerIdx = 0;
  let maxScore = 0;
  scorecard.scores.forEach((row, i) => {
    if (row[overallIdx] > maxScore) {
      maxScore = row[overallIdx];
      winnerIdx = i;
    }
  });

  return (
    <div className="rounded-xl border border-amber-500/20 bg-zinc-50 dark:bg-zinc-900/50 p-4 mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Scorecard
      </p>

      {/* Category headers */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `140px repeat(${scorecard.categories.length}, 1fr)` }}>
        <div /> {/* Empty cell for option label column */}
        {scorecard.categories.map((cat) => (
          <div key={cat} className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-center">
            {cat}
          </div>
        ))}

        {/* Option rows */}
        {scorecard.options.map((option, optIdx) => {
          const color = COLORS[optIdx % COLORS.length];
          const isWinner = optIdx === winnerIdx;

          return (
            <React.Fragment key={`option-${optIdx}`}>
              {/* Option label */}
              <div
                className={`flex items-center gap-2 text-xs font-medium truncate ${
                  isWinner ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {isWinner && <span className="text-amber-400 text-sm">👑</span>}
                <span className="truncate">{option}</span>
              </div>

              {/* Score bars */}
              {scorecard.scores[optIdx].map((score, catIdx) => (
                <div key={`${optIdx}-${catIdx}`} className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color.bar} transition-all duration-700 ease-out`}
                      style={{
                        width: animate ? `${(score / 10) * 100}%` : '0%',
                        transitionDelay: `${(optIdx * scorecard.categories.length + catIdx) * 50}ms`,
                      }}
                    />
                  </div>
                  <span className={`text-xs font-mono ${color.text} w-4 text-right`}>
                    {score}
                  </span>
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
