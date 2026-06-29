'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ExpertPerspective } from '@/types/debate';
import { translate as t, type TKey } from '@/lib/translations';
import { useUILang } from '@/app/hooks/useUILang';

type InputMode = 'smart' | 'manual';

interface ParsedOption {
  name: string;
  expert: string;
}

export default function Home() {
  const router = useRouter();

  // Mode toggle
  const [mode, setMode] = useState<InputMode>('smart');

  // Smart mode state
  const [prompt, setPrompt] = useState('');
  const [parsedOptions, setParsedOptions] = useState<ParsedOption[] | null>(null);
  const [parsedContext, setParsedContext] = useState('');
  const [parsing, setParsing] = useState(false);

  // Manual mode state
  const [options, setOptions] = useState(['', '']);
  const [context, setContext] = useState('');

  // Shared state
  const [language, setLanguage] = useState('English');
  const { uiLang, toggleUILang } = useUILang();
  const [model, setModel] = useState('sonnet');
  const [customModel, setCustomModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Fetch OpenRouter models on mount ──
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        if (data.models?.length) {
          setAvailableModels(data.models);
          if (model === 'sonnet') setModel(data.models[0].id); // ponytail: don't overwrite user selection
        }
      })
      .catch(() => {}); // silent — dropdown stays empty, custom input fallback
  }, []);

  // ── Manual mode helpers ──
  const addOption = () => {
    if (options.length < 4) setOptions([...options, '']);
  };

  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const updateOption = (i: number, value: string) => {
    setOptions(options.map((o, idx) => (idx === i ? value : o)));
  };

  // ── Smart mode: parse prompt ──
  const handleParsePrompt = async () => {
    if (prompt.trim().length < 10) {
      setError(t('errorNeedMoreDetail', uiLang));
      return;
    }

    setParsing(true);
    setError('');
    setParsedOptions(null);

    const effectiveModel = model === '__custom__' ? customModel.trim() || 'deepseek-chat' : model;

    try {
      const res = await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), language, model: effectiveModel }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('errorAnalyzeFailed', uiLang));
      }

      const data = await res.json() as { options: ParsedOption[]; context: string };
      setParsedOptions(data.options);
      setParsedContext(data.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
    }
  };

  // ── Smart mode: edit parsed option ──
  const updateParsedOption = (i: number, field: 'name' | 'expert', value: string) => {
    if (!parsedOptions) return;
    setParsedOptions(parsedOptions.map((o, idx) =>
      idx === i ? { ...o, [field]: value } : o
    ));
  };

  const removeParsedOption = (i: number) => {
    if (!parsedOptions || parsedOptions.length <= 2) return;
    setParsedOptions(parsedOptions.filter((_, idx) => idx !== i));
  };

  // ── Start debate ──
  const handleStartDebate = async (e?: React.FormEvent) => {
    e?.preventDefault();

    let finalOptions: string[];
    let finalContext: string;
    let experts: ExpertPerspective[] | undefined;

    if (mode === 'smart') {
      if (!parsedOptions || parsedOptions.length < 2) {
        setError(t('errorAnalyzeFirst', uiLang));
        return;
      }
      finalOptions = parsedOptions.map((o) => o.name);
      finalContext = parsedContext;
      experts = parsedOptions.map((o) => ({ option: o.name, expert: o.expert }));
    } else {
      const filled = options.map((o) => o.trim()).filter(Boolean);
      if (filled.length < 2) {
        setError(t('errorNeedTwoOptions', uiLang));
        return;
      }
      finalOptions = filled;
      finalContext = context.trim();
    }

    const effectiveModel = model === '__custom__' ? customModel.trim() || 'deepseek-chat' : model;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          options: finalOptions,
          context: finalContext,
          language,
          model: effectiveModel,
          experts,
          autoMode,
        }),
      });

      if (!res.ok) throw new Error(t('errorStartFailed', uiLang));
      const { id } = await res.json();

      // Encode experts in URL params for the debate page
      const params = new URLSearchParams({
        id,
        options: JSON.stringify(finalOptions),
      });
      if (experts) {
        params.set('experts', JSON.stringify(experts));
      }
      if (prompt.trim()) {
        params.set('prompt', prompt.trim());
      }
      params.set("language", language);
      params.set('model', effectiveModel);

      router.push(`/debate?${params.toString()}`);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const placeholders = [
    'e.g. MacBook Pro',
    'e.g. Dell XPS 15',
    'e.g. ThinkPad X1',
    'e.g. Surface Laptop',
  ];

  const expertColors = [
    'border-blue-500/30 bg-blue-950/20',
    'border-emerald-500/30 bg-emerald-950/20',
    'border-violet-500/30 bg-violet-950/20',
    'border-orange-500/30 bg-orange-950/20',
    'border-pink-500/30 bg-pink-950/20',
    'border-cyan-500/30 bg-cyan-950/20',
  ];

  const expertTextColors = [
    'text-blue-400',
    'text-emerald-400',
    'text-violet-400',
    'text-orange-400',
    'text-pink-400',
    'text-cyan-400',
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 relative">
          <button
            onClick={toggleUILang}
            className="absolute top-0 right-0 text-xs px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition"
            title={uiLang === 'en' ? 'Türkçe\'ye geç' : 'Switch to English'}
          >
            {uiLang === 'en' ? '🇹🇷 TR' : '🇬🇧 EN'}
          </button>
          <div className="text-6xl mb-2">⚖️</div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Think Twice', uiLang)}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
            {t('heroDesc', uiLang)}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-800 p-1">
            <button
              type="button"
              onClick={() => { setMode('smart'); setError(''); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                mode === 'smart'
                  ? 'bg-white text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {t('Smart Mode', uiLang)}
            </button>
            <button
              type="button"
              onClick={() => { setMode('manual'); setError(''); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                mode === 'manual'
                  ? 'bg-white text-black'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {t('Manual Mode', uiLang)}
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'manual' ? handleStartDebate : (e) => { e.preventDefault(); parsedOptions ? handleStartDebate() : handleParsePrompt(); }} className="space-y-5">

          {/* ════ SMART MODE ════ */}
          {mode === 'smart' && (
            <>
              {/* Big textarea prompt */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  {t('Describe your decision', uiLang)}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setParsedOptions(null); }}
                  placeholder={t('smartPlaceholder', uiLang)}
                  rows={5}
                  disabled={parsing || loading}
                  className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition resize-y disabled:opacity-50"
                />
                <p className="text-[10px] text-zinc-500">
                  {t('smartHint', uiLang)}
                </p>
              </div>

              {/* Parsed results — editable */}
              {parsedOptions && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                      {t('Options & Expert Advocates', uiLang)}
                    </label>
                    <span className="text-[10px] text-zinc-500">{t('Edit any field before starting', uiLang)}</span>
                  </div>

                  {parsedOptions.map((opt, i) => (
                    <div key={i} className={`rounded-xl border p-3 space-y-2 ${expertColors[i % expertColors.length]}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                          {String.fromCharCode(65 + i)}
                        </div>
                        <input
                          type="text"
                          value={opt.name}
                          onChange={(e) => updateParsedOption(i, 'name', e.target.value)}
                          className="flex-1 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 px-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
                        />
                        {parsedOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeParsedOption(i)}
                            className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-red-900/40 text-zinc-600 dark:text-zinc-400 hover:text-red-400 text-sm transition shrink-0"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <span className={`text-[10px] font-semibold uppercase tracking-widest ${expertTextColors[i % expertTextColors.length]} shrink-0`}>
                          {t('Expert', uiLang)}
                        </span>
                        <input
                          type="text"
                          value={opt.expert}
                          onChange={(e) => updateParsedOption(i, 'expert', e.target.value)}
                          className="flex-1 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/30 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Parsed context (editable) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                      {t('Extracted Context', uiLang)}
                    </label>
                    <textarea
                      value={parsedContext}
                      onChange={(e) => setParsedContext(e.target.value)}
                      rows={2}
                      className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition resize-y"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════ MANUAL MODE ════ */}
          {mode === 'manual' && (
            <>
              {/* Options */}
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  {t('Options to compare', uiLang)}
                </label>

                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex items-center justify-center w-8 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </div>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={placeholders[i] ?? `Option ${i + 1}`}
                      className="flex-1 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-900/40 text-zinc-600 dark:text-zinc-400 hover:text-red-400 text-lg transition shrink-0"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}

                {options.length < 4 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="w-full h-9 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-500 transition"
                  >
                    {t('Add another option', uiLang)}
                  </button>
                )}
              </div>

              {/* Context */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                  {t('Context', uiLang)} <span className="font-normal normal-case text-zinc-500">({t('optional', uiLang)})</span>
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={t('contextPlaceholder', uiLang)}
                  rows={3}
                  className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition resize-none"
                />
              </div>
            </>
          )}

          {/* Settings row: Language + Model */}
          <div className="grid grid-cols-2 gap-3">
            {/* Language */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t('Language', uiLang)}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-500 transition appearance-none cursor-pointer"
              >
                <option value="English">&#x1F1EC;&#x1F1E7; English</option>
                <option value="Turkish">&#x1F1F9;&#x1F1F7; T&uuml;rk&ccedil;e</option>
                <option value="German">&#x1F1E9;&#x1F1EA; Deutsch</option>
                <option value="French">&#x1F1EB;&#x1F1F7; Fran&ccedil;ais</option>
                <option value="Spanish">&#x1F1EA;&#x1F1F8; Espa&ntilde;ol</option>
                <option value="Italian">&#x1F1EE;&#x1F1F9; Italiano</option>
                <option value="Portuguese">&#x1F1F5;&#x1F1F9; Portugu&ecirc;s</option>
                <option value="Dutch">&#x1F1F3;&#x1F1F1; Nederlands</option>
                <option value="Japanese">&#x1F1EF;&#x1F1F5; &#x65E5;&#x672C;&#x8A9E;</option>
                <option value="Korean">&#x1F1F0;&#x1F1F7; &#xD55C;&#xAD6D;&#xC5B4;</option>
                <option value="Chinese">&#x1F1E8;&#x1F1F3; &#x4E2D;&#x6587;</option>
                <option value="Arabic">&#x1F1F8;&#x1F1E6; &#x627;&#x644;&#x639;&#x631;&#x628;&#x64A;&#x629;</option>
                <option value="Russian">&#x1F1F7;&#x1F1FA; &#x420;&#x443;&#x441;&#x441;&#x43A;&#x438;&#x439;</option>
                <option value="Hindi">&#x1F1EE;&#x1F1F3; &#x939;&#x93F;&#x928;&#x94D;&#x926;&#x940;</option>
              </select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {t('Model', uiLang)}
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-500 transition appearance-none cursor-pointer"
              >
                {availableModels.length === 0 && (
                  <option disabled>{t('Loading models…', uiLang)}</option>
                )}
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
                <option disabled className="text-zinc-400 dark:text-zinc-600">──────────────</option>
                <option value="__custom__">{t('Custom model…', uiLang)}</option>
              </select>
                {model === '__custom__' && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder={t('customPlaceholder', uiLang)}
                    className="mt-2 w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
                  />
                )}
            </div>
          </div>

          {/* Auto-pilot toggle */}
          <div className="flex items-center justify-between rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 px-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t('Auto-pilot mode', uiLang)}</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {t('autoPilotDesc', uiLang)}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoMode}
              onClick={() => setAutoMode(!autoMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                autoMode ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Action buttons */}
          {mode === 'smart' && !parsedOptions && (
            <button
              type="submit"
              disabled={parsing || prompt.trim().length < 10}
              className="w-full h-11 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition
                bg-zinc-950 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              {parsing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                  {t('Analyzing your decision...', uiLang)}
                </span>
              ) : t('Analyze & Set Up Debate', uiLang)}
            </button>
          )}

          {mode === 'smart' && parsedOptions && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setParsedOptions(null)}
                className="flex-1 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              >
                {t('Re-analyze', uiLang)}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] h-11 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition
                  bg-zinc-950 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100"
              >
                {loading ? t('Starting debate...', uiLang) : t('Start Debate with Experts →', uiLang)}
              </button>
            </div>
          )}

          {mode === 'manual' && (
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition
                bg-zinc-950 dark:bg-white text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-100"
            >
              {loading ? t('Starting debate...', uiLang) : t('Start Debate →', uiLang)}
            </button>
          )}
        </form>

        {/* How it works */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 text-center">
            {t('How it works', uiLang)}
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '\uD83D\uDD0D', label: t('Step 1', uiLang), desc: mode === 'smart' ? t('step1Smart', uiLang) : t('step1Manual', uiLang) },
              { icon: '\u2694\uFE0F', label: t('Step 2', uiLang), desc: t('step2', uiLang) },
              { icon: '\u2696\uFE0F', label: t('Step 3', uiLang), desc: t('step3', uiLang) },
            ].map((step) => (
              <div key={step.label} className="space-y-1.5">
                <div className="text-2xl">{step.icon}</div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{step.label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* History link */}
        <div className="text-center">
          <button
            onClick={() => router.push(`/history?lang=${encodeURIComponent(language)}`)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition underline underline-offset-2"
          >
            {t('View past debates', uiLang)}
          </button>
        </div>
      </div>
    </div>
  );
}
