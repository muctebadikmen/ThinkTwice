'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AgentPanel from '@/app/components/AgentPanel';
import VerdictCard from '@/app/components/VerdictCard';
import JudgeQuestionCard from '@/app/components/JudgeQuestionCard';
import JudgeNotesCard from '@/app/components/JudgeNotesCard';
import UserInputCard from '@/app/components/UserInputCard';
import ChallengeVerdictCard from '@/app/components/ChallengeVerdictCard';
import CollapsibleRound from '@/app/components/CollapsibleRound';
import RoundTimeline from '@/app/components/RoundTimeline';
import ConfidenceSparkline from '@/app/components/ConfidenceSparkline';
import TypingIndicator from '@/app/components/TypingIndicator';
import TopicHighlights from '@/app/components/TopicHighlights';
import { useAutoScroll } from '@/app/hooks/useAutoScroll';
import { parseConfidenceScores } from '@/lib/confidence-parser';
import { DebatePhase, DebateEvent, ExpertPerspective, SavedDebate, DebateRound } from '@/types/debate';
import { translate as t } from '@/lib/translations';
import { useUILang } from '@/app/hooks/useUILang';

interface RoundState {
  roundNumber: number;
  judgeQuestion: string;
  judgeQuestionDone: boolean;
  judgeQuestionStreaming: boolean;
  responses: string[];
  responseDone: boolean[];
  evaluationText: string;
  evaluationStreaming: boolean;
  evaluationDecision: 'continue' | 'verdict' | null;
  scores: Record<string, number> | null;
  userClarificationQuestion?: string;
  userClarificationAnswer?: string;
}

function DebatePageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const id = params.get('id');
  const optionsParam = params.get('options');
  const options = optionsParam ? JSON.parse(decodeURIComponent(optionsParam)) as string[] : [];
  const expertsParam = params.get('experts');
  const experts: ExpertPerspective[] | null = expertsParam
    ? JSON.parse(decodeURIComponent(expertsParam)) as ExpertPerspective[]
    : null;
  const promptParam = params.get('prompt') || '';
  const languageParam = params.get('language') || 'English';
  const modelParam = params.get('model') || 'sonnet';
  const { uiLang, toggleUILang } = useUILang();

  const [phase, setPhase] = useState<DebatePhase>('idle');
  const [currentRound, setCurrentRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(8);
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [verdict, setVerdict] = useState('');
  const [verdictStreaming, setVerdictStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [agentsActive, setAgentsActive] = useState<boolean[]>(options.map(() => false));

  // Build expert lookup
  const expertMap = new Map<string, string>();
  if (experts) {
    for (const e of experts) {
      expertMap.set(e.option, e.expert);
    }
  }

  // Auto-scroll
  const scrollTrigger = `${phase}-${currentRound}-${done}`;
  const { targetRef: autoScrollRef } = useAutoScroll(scrollTrigger);
  const verdictRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  // Auto-scroll to verdict when it starts
  useEffect(() => {
    if (verdictStreaming && verdictRef.current) {
      verdictRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [verdictStreaming]);

  // Save debate to localStorage when complete
  const saveDebate = useCallback(() => {
    if (!id || !done || !verdict) return;

    const debateRounds: DebateRound[] = rounds.map((r) => ({
      roundNumber: r.roundNumber,
      judgeQuestion: r.judgeQuestion,
      responses: options.map((option, i) => ({
        agentIndex: i,
        option,
        response: r.responses[i] || '',
      })),
      userClarification: r.userClarificationQuestion
        ? {
            afterRound: r.roundNumber,
            question: r.userClarificationQuestion,
            answer: r.userClarificationAnswer || '',
          }
        : undefined,
    }));

    const savedDebate: SavedDebate = {
      id,
      options,
      context: '',
      experts: experts ?? undefined,
      verdict,
      rounds: debateRounds,
      maxRounds,
      language: languageParam,
      model: modelParam,
      createdAt: Date.now(),
      prompt: promptParam || undefined,
    };

    try {
      const existing = JSON.parse(localStorage.getItem('decision-maker-debates') || '[]') as SavedDebate[];
      const filtered = existing.filter((d) => d.id !== id);
      filtered.unshift(savedDebate);
      const trimmed = filtered.slice(0, 50);
      localStorage.setItem('decision-maker-debates', JSON.stringify(trimmed));
    } catch {
      // localStorage might be full or unavailable
    }
  }, [id, done, verdict, rounds, options, experts, maxRounds, languageParam, modelParam, promptParam]);

  useEffect(() => {
    if (done && verdict) {
      saveDebate();
    }
  }, [done, verdict, saveDebate]);

  // ── Seed prior rounds for a continuation debate ──
  // Runs once on mount, before the SSE stream starts appending new rounds, so
  // the continuation's saved record includes the full debate history (not just
  // the offset-numbered tail rounds the backend produces).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!id || seededRef.current) return;
    seededRef.current = true;

    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(`continuation:${id}`);
      if (stored) sessionStorage.removeItem(`continuation:${id}`);
    } catch {
      return;
    }
    if (!stored) return;

    let priorRounds: DebateRound[];
    try {
      priorRounds = JSON.parse(stored) as DebateRound[];
    } catch {
      return;
    }
    if (!Array.isArray(priorRounds) || priorRounds.length === 0) return;

    const seeded: RoundState[] = priorRounds.map((r) => ({
      roundNumber: r.roundNumber,
      judgeQuestion: r.judgeQuestion,
      judgeQuestionDone: true,
      judgeQuestionStreaming: false,
      responses: options.map((_, i) => r.responses[i]?.response ?? ''),
      responseDone: options.map(() => true),
      evaluationText: '',
      evaluationStreaming: false,
      evaluationDecision: 'continue',
      scores: null,
      userClarificationQuestion: r.userClarification?.question,
      userClarificationAnswer: r.userClarification?.answer,
    }));

    setRounds(seeded);
    setCurrentRound(priorRounds[priorRounds.length - 1].roundNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const es = new EventSource(`/api/debate/stream?id=${id}`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as DebateEvent;

      switch (event.type) {
        case 'done':
          doneRef.current = true;
          setDone(true);
          setPhase('complete');
          setVerdictStreaming(false);
          es.close();
          break;

        case 'error':
          doneRef.current = true;
          setDone(true);
          es.close();
          break;

        case 'round_start':
          setCurrentRound(event.round!);
          setMaxRounds(event.maxRounds ?? 8);
          setRounds((prev) => [
            ...prev,
            {
              roundNumber: event.round!,
              judgeQuestion: '',
              judgeQuestionDone: false,
              judgeQuestionStreaming: false,
              responses: options.map(() => ''),
              responseDone: options.map(() => false),
              evaluationText: '',
              evaluationStreaming: false,
              evaluationDecision: null,
              scores: null,
            },
          ]);
          break;

        case 'phase_start':
          setPhase(event.phase!);
          if (event.phase === 'judge_question') {
            setRounds((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last) {
                updated[updated.length - 1] = { ...last, judgeQuestionStreaming: true };
              }
              return updated;
            });
          }
          if (event.phase === 'advocate_response') {
            setAgentsActive(options.map(() => true));
          }
          if (event.phase === 'evaluation') {
            setAgentsActive(options.map(() => false));
            setRounds((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last) {
                updated[updated.length - 1] = { ...last, evaluationStreaming: true };
              }
              return updated;
            });
          }
          if (event.phase === 'verdict') {
            setVerdictStreaming(true);
            setAgentsActive(options.map(() => false));
          }
          break;

        case 'judge_question_chunk':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              updated[roundIdx] = {
                ...updated[roundIdx],
                judgeQuestion: updated[roundIdx].judgeQuestion + (event.chunk ?? ''),
              };
            }
            return updated;
          });
          break;

        case 'judge_question_done':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              updated[roundIdx] = {
                ...updated[roundIdx],
                judgeQuestion: event.chunk ?? updated[roundIdx].judgeQuestion,
                judgeQuestionDone: true,
                judgeQuestionStreaming: false,
              };
            }
            return updated;
          });
          break;

        case 'agent_chunk':
          if (event.agentIndex !== undefined) {
            const idx = event.agentIndex;
            setRounds((prev) => {
              const updated = [...prev];
              const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
              if (roundIdx !== -1) {
                const newResponses = [...updated[roundIdx].responses];
                newResponses[idx] = newResponses[idx] + (event.chunk ?? '');
                updated[roundIdx] = { ...updated[roundIdx], responses: newResponses };
              }
              return updated;
            });
          }
          break;

        case 'agent_done':
          if (event.agentIndex !== undefined) {
            const idx = event.agentIndex;
            setAgentsActive((prev) => prev.map((a, i) => (i === idx ? false : a)));
            setRounds((prev) => {
              const updated = [...prev];
              const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
              if (roundIdx !== -1) {
                const newDone = [...updated[roundIdx].responseDone];
                newDone[idx] = true;
                updated[roundIdx] = { ...updated[roundIdx], responseDone: newDone };
              }
              return updated;
            });
          }
          break;

        case 'evaluation_chunk':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              updated[roundIdx] = {
                ...updated[roundIdx],
                evaluationText: updated[roundIdx].evaluationText + (event.chunk ?? ''),
              };
            }
            return updated;
          });
          break;

        case 'evaluation_done':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              const evalText = updated[roundIdx].evaluationText;
              const scores = parseConfidenceScores(evalText, options);
              updated[roundIdx] = {
                ...updated[roundIdx],
                evaluationDecision: event.decision ?? null,
                evaluationStreaming: false,
                scores,
              };
            }
            return updated;
          });
          break;

        case 'user_input_request':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              updated[roundIdx] = {
                ...updated[roundIdx],
                userClarificationQuestion: event.question ?? '',
              };
            }
            return updated;
          });
          break;

        case 'user_input_received':
          setRounds((prev) => {
            const updated = [...prev];
            const roundIdx = updated.findIndex((r) => r.roundNumber === event.round);
            if (roundIdx !== -1) {
              updated[roundIdx] = {
                ...updated[roundIdx],
                userClarificationAnswer: event.userInput ?? '',
              };
            }
            return updated;
          });
          break;

        case 'verdict_chunk':
          setVerdict((v) => v + (event.chunk ?? ''));
          break;

        case 'verdict_done':
          setVerdictStreaming(false);
          break;
      }
    };

    es.onerror = () => {
      // Transient drop: let EventSource auto-reconnect. It resends Last-Event-ID
      // and the server resumes after the last delivered event, so no duplication.
      // Only stop retrying once the debate has actually finished.
      if (doneRef.current) es.close();
    };

    return () => {
      doneRef.current = true;
      es.close();
    };
  }, [id]);

  const phaseLabel = (): string => {
    if (phase === 'idle') return t('Starting\u2026', uiLang);
    if (phase === 'complete') return t('Debate complete', uiLang);
    if (phase === 'verdict') return t('Judge is delivering the verdict', uiLang);
    const r = currentRound, m = maxRounds;
    if (phase === 'judge_question') return t('Phase round judge question', uiLang).replace('{round}', String(r)).replace('{max}', String(m));
    if (phase === 'advocate_response') return t('Phase round advocates', uiLang).replace('{round}', String(r)).replace('{max}', String(m));
    if (phase === 'evaluation') return t('Phase round evaluating', uiLang).replace('{round}', String(r)).replace('{max}', String(m));
    if (phase === 'user_input') return t('Phase round waiting', uiLang).replace('{round}', String(r)).replace('{max}', String(m));
    return '';
  };

  const handleUserInputSubmit = async (roundNumber: number, input: string) => {
    await fetch('/api/debate/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, input }),
    });
    setRounds((prev) => {
      const updated = [...prev];
      const roundIdx = updated.findIndex((r) => r.roundNumber === roundNumber);
      if (roundIdx !== -1) {
        updated[roundIdx] = { ...updated[roundIdx], userClarificationAnswer: input };
      }
      return updated;
    });
  };

  // ── Continue Mode: challenge the verdict and start a new debate ──
  const handleContinueDebate = useCallback(async (challenge: string) => {
    if (!id) return;

    const debateRounds: DebateRound[] = rounds.map((r) => ({
      roundNumber: r.roundNumber,
      judgeQuestion: r.judgeQuestion,
      responses: options.map((option, i) => ({
        agentIndex: i,
        option,
        response: r.responses[i] || '',
      })),
    }));

    await fetch('/api/debate/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        debateId: id,
        rounds: debateRounds,
        verdict,
      }),
    });

    const res = await fetch('/api/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        options,
        context: '',
        language: languageParam,
        model: modelParam,
        experts: experts ?? undefined,
        continueFromDebateId: id,
        userChallenge: challenge,
      }),
    });

    if (!res.ok) throw new Error(t('errorContinueFailed', uiLang));
    const { id: newId } = await res.json();

    // Seed the continuation page with the prior rounds so its saved record
    // contains the full debate arc. The backend numbers the new rounds with an
    // offset (continuing after the previous rounds), so without this the new
    // page would only ever show/save the tail rounds with gaps in numbering.
    try {
      sessionStorage.setItem(`continuation:${newId}`, JSON.stringify(debateRounds));
    } catch {
      // sessionStorage may be unavailable — continuation still works, just
      // without the prior rounds shown on the new page.
    }

    const newParams = new URLSearchParams({
      id: newId,
      options: JSON.stringify(options),
      language: languageParam,
      model: modelParam,
    });
    if (experts) {
      newParams.set('experts', JSON.stringify(experts));
    }
    if (promptParam) {
      newParams.set('prompt', promptParam);
    }

    router.push(`/debate?${newParams.toString()}`);
  }, [id, rounds, options, verdict, languageParam, modelParam, experts, promptParam, router]);

  const activeAgentCount = agentsActive.filter(Boolean).length;

  // Sparkline data
  const sparklineRounds = rounds.map((r) => ({
    roundNumber: r.roundNumber,
    scores: r.scores,
  }));
  const hasSparklineData = sparklineRounds.some((r) => r.scores !== null);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white">
      {/* Round Timeline Sidebar */}
      <RoundTimeline
        rounds={rounds.map((r) => ({
          roundNumber: r.roundNumber,
          judgeQuestion: r.judgeQuestion,
        }))}
        currentRound={currentRound}
        maxRounds={maxRounds}
        done={done}
      />

      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-white dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
        >
          &larr; {t('Back', uiLang)}
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleUILang}
              className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            >
              {uiLang === 'en' ? '🇹🇷' : '🇬🇧'}
            </button>
            <span className="text-sm text-zinc-500">
              {rounds.length} {t('rounds', uiLang)} &middot; {languageParam} &middot; {modelParam}
            </span>
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
            {!done && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            {phaseLabel()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasSparklineData && (
            <ConfidenceSparkline rounds={sparklineRounds} options={options} />
          )}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxRounds }, (_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i + 1 < currentRound
                    ? 'bg-green-500'
                    : i + 1 === currentRound
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Verdict card (shown when verdict phase starts) */}
        {(verdictStreaming || verdict) && (
          <div ref={verdictRef}>
            <VerdictCard text={verdict} isStreaming={verdictStreaming} lang={uiLang} />
          </div>
        )}

        {/* Continue Mode — challenge the verdict */}
        {done && verdict && (
          <ChallengeVerdictCard onContinue={handleContinueDebate} lang={uiLang} />
        )}

        {/* Rounds timeline */}
        {rounds.map((round, roundIdx) => {
          const isCurrentRound = round.roundNumber === currentRound && !done;
          const isRoundComplete = round.responseDone.every(Boolean);

          return (
            <div
              key={round.roundNumber}
              id={`round-${round.roundNumber}`}
              ref={roundIdx === rounds.length - 1 ? autoScrollRef : undefined}
            >
              <CollapsibleRound
                roundNumber={round.roundNumber}
                maxRounds={maxRounds}
                isCurrentRound={isCurrentRound}
                judgeQuestion={round.judgeQuestion}
                lang={uiLang}
              >
                <div className="space-y-4">
                  <JudgeQuestionCard
                    roundNumber={round.roundNumber}
                    maxRounds={maxRounds}
                    question={round.judgeQuestion}
                    isStreaming={round.judgeQuestionStreaming}
                    lang={uiLang}
                  />

                  {(round.judgeQuestionDone || round.responses.some((r) => r.length > 0)) && (
                    <div
                      className="grid gap-4"
                      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
                    >
                      {options.map((option, i) => (
                        <AgentPanel
                          key={`${round.roundNumber}-${i}`}
                          index={i}
                          option={option}
                          roundNumber={round.roundNumber}
                          responseText={round.responses[i]}
                          isActive={agentsActive[i] && currentRound === round.roundNumber}
                          isDone={round.responseDone[i]}
                          expertLabel={expertMap.get(option)}
                          lang={uiLang}
                        />
                      ))}
                    </div>
                  )}

                  {isRoundComplete && (
                    <TopicHighlights
                      responses={round.responses}
                      options={options}
                      isRoundComplete={isRoundComplete}
                    />
                  )}

                  {(round.evaluationText || round.evaluationStreaming) && (
                    <JudgeNotesCard
                      text={round.evaluationText}
                      isStreaming={round.evaluationStreaming}
                      decision={round.evaluationDecision}
                      lang={uiLang}
                    />
                  )}

                  {round.userClarificationQuestion && (
                    <UserInputCard
                      question={round.userClarificationQuestion}
                      roundNumber={round.roundNumber}
                      onSubmit={(input) => handleUserInputSubmit(round.roundNumber, input)}
                      isSubmitted={!!round.userClarificationAnswer}
                      submittedAnswer={round.userClarificationAnswer}
                      lang={uiLang}
                    />
                  )}
                </div>
              </CollapsibleRound>
            </div>
          );
        })}

        {/* Done footer */}
        {done && (
          <div className="text-center pt-4 pb-16">
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm text-zinc-800 dark:text-zinc-200 transition"
            >
              {t('Start a new debate', uiLang)}
            </button>
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator
        phase={phase}
        currentRound={currentRound}
        maxRounds={maxRounds}
        activeAgentCount={activeAgentCount}
        lang={uiLang}
      />
    </div>
  );
}

export default function DebatePage() {
  return (
    <Suspense>
      <DebatePageInner />
    </Suspense>
  );
}
