'use client';

interface RoundInfo {
  roundNumber: number;
  judgeQuestion: string;
}

interface RoundTimelineProps {
  rounds: RoundInfo[];
  currentRound: number;
  maxRounds: number;
  done: boolean;
}

export default function RoundTimeline({
  rounds,
  currentRound,
  maxRounds,
  done,
}: RoundTimelineProps) {
  const handleDotClick = (roundNumber: number) => {
    const el = document.getElementById(`round-${roundNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-1">
      {/* Label */}
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 [writing-mode:vertical-lr] rotate-180">
        Round {done ? rounds.length : currentRound}/{maxRounds}
      </div>

      {/* Dots with connecting line */}
      <div className="relative flex flex-col items-center gap-2">
        {/* Connecting line */}
        <div className="absolute top-1 bottom-1 w-px bg-zinc-100 dark:bg-zinc-800" />

        {Array.from({ length: maxRounds }, (_, i) => {
          const roundNum = i + 1;
          const isComplete = done
            ? roundNum <= rounds.length
            : roundNum < currentRound;
          const isCurrent = !done && roundNum === currentRound;
          const hasRound = rounds.find((r) => r.roundNumber === roundNum);
          const question = hasRound?.judgeQuestion || '';
          const truncated = question.length > 60 ? question.slice(0, 60) + '…' : question;

          return (
            <div key={roundNum} className="relative group">
              <button
                onClick={() => hasRound && handleDotClick(roundNum)}
                disabled={!hasRound}
                className={`relative z-10 w-3 h-3 rounded-full transition-all duration-200 ${
                  isComplete
                    ? 'bg-green-500 hover:bg-green-400 cursor-pointer'
                    : isCurrent
                    ? 'bg-amber-400 animate-pulse cursor-pointer'
                    : 'bg-zinc-200 dark:bg-zinc-700 cursor-default'
                }`}
              />

              {/* Tooltip */}
              {truncated && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block">
                  <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 max-w-60 whitespace-normal shadow-xl">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">R{roundNum}:</span>{' '}
                    {truncated}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
