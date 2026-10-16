import {
  ArrowLeftRight,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FileUp,
  Info,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Check,
  CircleCheck,
} from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { Bike, Wordmark } from './components/Bike';
import { OptionsPanel } from './components/OptionsPanel';
import { StatusPill, statusLabel } from './components/StatusPill';
import { UpdateBanner } from './components/UpdateBanner';
import { convert, DEFAULT_OPTIONS, type ConvertOptions } from './lib/convert';
import { buildExport, copyText, downloadText, exportFilename, ImportError, readClipboard, readTextFile, type ExportFormat } from './lib/files';
import { describeSeparator } from './lib/presets';
import { loadOptions, loadTheme, saveOptions, saveTheme, stashForUpdate, takeUpdateStash, type Theme } from './lib/storage';
import { useOfflineStatus } from './pwa/useOfflineStatus';

const SAMPLE = 'Apple\nBanana\nCherry\nMango';

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  // User text lives only in React state (memory). It is never persisted, except the
  // one-shot sessionStorage handoff when the user explicitly approves an update.
  const [input, setInput] = useState<string>(() => takeUpdateStash() ?? '');
  const [options, setOptions] = useState<ConvertOptions>(loadOptions);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [showOptions, setShowOptions] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt');
  const [announce, setAnnounce] = useState('');
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pedaling, setPedaling] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pedalTimer = useRef<number>();
  const status = useOfflineStatus();

  // Keep huge pastes responsive: conversion runs on a deferred copy of the input.
  const deferredInput = useDeferredValue(input);
  const result = useMemo(() => convert(deferredInput, options), [deferredInput, options]);
  const stale = deferredInput !== input;

  useEffect(() => saveOptions(options), [options]);

  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
    document.documentElement.classList.toggle('dark', dark);
    saveTheme(theme);
  }, [theme]);

  // Remove the HTML splash once React has painted.
  useEffect(() => {
    const s = document.getElementById('splash');
    if (!s) return;
    s.classList.add('hide');
    const t = window.setTimeout(() => s.remove(), 400);
    return () => window.clearTimeout(t);
  }, []);

  const toastTimer = useRef<number>();
  const say = useCallback((msg: string) => {
    setAnnounce('');
    window.clearTimeout(toastTimer.current);
    window.setTimeout(() => setAnnounce(msg), 30);
    toastTimer.current = window.setTimeout(() => setAnnounce(''), 2800);
  }, []);

  const pedal = useCallback(() => {
    setPedaling(true);
    window.clearTimeout(pedalTimer.current);
    pedalTimer.current = window.setTimeout(() => setPedaling(false), 700);
  }, []);

  const updateInput = useCallback(
    (v: string) => {
      setInput(v);
      pedal();
    },
    [pedal],
  );

  const patchOptions = useCallback((patch: Partial<ConvertOptions>) => {
    setOptions((o) => ({ ...o, ...patch }));
    pedal();
  }, [pedal]);

  const handlePaste = async () => {
    const text = await readClipboard();
    if (text === null) {
      inputRef.current?.focus();
      say('Clipboard access was blocked. Press Ctrl+V (⌘V) in the box to paste.');
      return;
    }
    updateInput(text);
    say('Pasted from clipboard.');
  };

  const handleCopy = useCallback(async () => {
    if (!result.output) return say('Nothing to copy yet.');
    const ok = await copyText(result.output);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      say(`Copied ${result.count} item${result.count === 1 ? '' : 's'} to clipboard.`);
    } else say('Copy failed. Select the result and press Ctrl+C (⌘C).');
  }, [result, say]);

  const handleDownload = useCallback(
    (format: ExportFormat = exportFormat) => {
      if (!result.output) return say('Nothing to download yet.');
      downloadText(buildExport(format, result.output, result.items), exportFilename(format), format);
      say(`Saved as ${format.toUpperCase()}.`);
    },
    [exportFormat, result, say],
  );

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      updateInput(text);
      say(`Imported ${file.name}.`);
    } catch (e) {
      say(e instanceof ImportError ? e.message : `Couldn't read ${file.name}.`);
    }
  };

  const swap = useCallback(() => {
    setOptions((o) => {
      const toColumn = o.direction === 'toList';
      return {
        ...o,
        direction: toColumn ? 'toColumn' : 'toList',
        // Use the current output separator to split the swapped text.
        splitOn: toColumn ? (o.separator.trim() || o.separator || ',') : o.splitOn,
      };
    });
    if (result.output) setInput(result.output);
    pedal();
    say('Direction swapped.');
  }, [result.output, pedal, say]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') {
        e.preventDefault();
        void handleCopy();
      } else if (k === 's' && !e.shiftKey) {
        e.preventDefault();
        handleDownload('txt');
      } else if (k === 'o' && !e.shiftKey) {
        e.preventDefault();
        fileRef.current?.click();
      } else if (k === 'x' && e.shiftKey) {
        e.preventDefault();
        swap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCopy, handleDownload, swap]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void importFile(e.dataTransfer.files?.[0]);
  };

  const toList = options.direction === 'toList';
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  const showUpdate = status.updateAvailable && !updateDismissed;

  const summary = toList
    ? `Separator: ${describeSeparator(options.separator)}`
    : `Splitting on: ${describeSeparator(options.splitOn)}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#starting-line" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">
        Skip to converter
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <a href="/" aria-label="Shim home" className="rounded-2xl">
          <Wordmark />
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <StatusPill status={status} onUpdateClick={() => setUpdateDismissed(false)} />
          <button
            type="button"
            className="icon-btn"
            aria-label={showOptions ? 'Hide formatting options' : 'Show formatting options'}
            aria-expanded={showOptions}
            aria-controls="options-region"
            onClick={() => setShowOptions((v) => !v)}
          >
            <SlidersHorizontal className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </button>
          <button type="button" className="icon-btn hidden sm:inline-flex" aria-label="About Shim" onClick={() => setAboutOpen(true)}>
            <Info className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 sm:px-6">
        <section className="pb-6 pt-8 text-center" aria-labelledby="hero-title">
          <div className="relative mx-auto h-12 w-56 overflow-hidden" aria-hidden>
            <div className="absolute inset-x-0 bottom-1 border-b-2 border-dashed border-line" />
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 animate-roll text-mint-deep">
              <Bike className={`h-11 w-11 ${pedaling ? 'animate-bob' : ''}`} spinning fast={pedaling} />
            </div>
          </div>
          <h1 id="hero-title" className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {toList ? 'Turn Your Columns Into Smooth Rides!' : 'Unpack Your List Into a Column!'}
          </h1>
          <p className="mt-1.5 text-muted">Paste your list. Pick your format. Enjoy the ride.</p>
        </section>

        <div className="relative grid gap-4 md:grid-cols-2 md:gap-5">
          {/* Starting line */}
          <section
            id="starting-line"
            aria-labelledby="start-label"
            className={`card flex flex-col p-4 transition sm:p-5 ${dragging ? 'ring-4 ring-mint' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <label id="start-label" htmlFor="input" className="font-extrabold">
                Your Starting Line
              </label>
              <div className="flex items-center gap-1">
                <button type="button" className="icon-btn h-9 w-9" onClick={() => fileRef.current?.click()} aria-label="Import a TXT or CSV file" title="Import file">
                  <FileUp className="h-[18px] w-[18px]" aria-hidden />
                </button>
                <button type="button" className="icon-btn h-9 w-9" onClick={() => updateInput('')} aria-label="Clear input" title="Clear" disabled={!input}>
                  <Eraser className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </div>
            </div>
            <textarea
              id="input"
              ref={inputRef}
              data-testid="input"
              className="well min-h-[13rem] flex-1 resize-y p-3 font-mono text-[0.92rem] leading-relaxed sm:min-h-[16rem]"
              value={input}
              onChange={(e) => updateInput(e.target.value)}
              placeholder={toList ? 'Apple\nBanana\nCherry\nMango\n\n…or paste spreadsheet columns, or drop a TXT/CSV file here' : 'Apple, Banana, Cherry, Mango'}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-describedby="input-hint"
            />
            <p id="input-hint" className="sr-only">
              Text you type stays on this device.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-mint flex-1" onClick={handlePaste}>
                <ClipboardPaste className="h-4 w-4" aria-hidden /> Paste List
              </button>
              {!input && (
                <button type="button" className="btn-ghost" onClick={() => updateInput(toList ? SAMPLE : SAMPLE.split('\n').join(', '))}>
                  Try example
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.tsv,.text,.md,.json,.log,text/plain,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              data-testid="file-input"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </section>

          {/* Swap button between the cards */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden -translate-y-1/2 justify-center md:flex">
            <button
              type="button"
              onClick={swap}
              className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition hover:rotate-180 hover:bg-mint-soft"
              aria-label={toList ? 'Swap: convert a list back into a column' : 'Swap: convert a column into a list'}
              title="Swap direction (Ctrl+Shift+X)"
            >
              <ArrowLeftRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="-my-1 flex justify-center md:hidden">
            <button type="button" onClick={swap} className="btn-ghost rounded-full py-1.5 text-sm">
              <ArrowLeftRight className="h-4 w-4 rotate-90" aria-hidden /> Swap direction
            </button>
          </div>

          {/* Destination */}
          <section aria-labelledby="dest-label" className="card flex flex-col p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <label id="dest-label" htmlFor="output" className="font-extrabold">
                Your Destination
              </label>
              <div className="flex items-center gap-1">
                <label htmlFor="export-format" className="sr-only">
                  Download format
                </label>
                <div className="relative">
                  <select
                    id="export-format"
                    className="h-9 cursor-pointer appearance-none rounded-xl border border-line bg-surface py-0 pl-3 pr-7 text-xs font-bold"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  >
                    <option value="txt">TXT</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                </div>
                <button
                  type="button"
                  className="icon-btn h-9 w-9"
                  onClick={() => handleDownload()}
                  disabled={!result.output}
                  aria-label={`Download result as ${exportFormat.toUpperCase()}`}
                  title="Download (Ctrl+S)"
                  data-testid="download"
                >
                  <Download className="h-[18px] w-[18px]" aria-hidden />
                </button>
              </div>
            </div>
            <textarea
              id="output"
              data-testid="output"
              readOnly
              className={`well min-h-[13rem] flex-1 resize-y p-3 font-mono text-[0.92rem] leading-relaxed transition-opacity sm:min-h-[16rem] ${stale ? 'opacity-60' : ''}`}
              value={result.output}
              placeholder="Your converted list rolls in here."
              aria-busy={stale}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn-peach mt-3" onClick={handleCopy} disabled={!result.output} data-testid="copy">
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? 'Copied!' : 'Copy Result'}
            </button>
          </section>
        </div>

        {/* Summary bar */}
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm sm:mt-5">
          <span className="font-semibold">{summary}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" data-testid="summary">
            {result.duplicatesRemoved > 0 && <span>{result.duplicatesRemoved} duplicate{result.duplicatesRemoved === 1 ? '' : 's'} removed</span>}
            {result.columns > 1 && toList && <span>{result.columns} columns</span>}
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="h-4 w-4" aria-hidden />
              {result.count} item{result.count === 1 ? '' : 's'} converted
            </span>
          </span>
        </div>

        {showOptions && (
          <section id="options-region" aria-label="Formatting options" className="card mt-4 animate-fade-up p-4 sm:mt-5 sm:p-5">
            <OptionsPanel
              options={options}
              onChange={patchOptions}
              onReset={() => setOptions({ ...DEFAULT_OPTIONS })}
              columnsDetected={result.columns}
              detectedDelimiter={result.detectedDelimiter}
            />
          </section>
        )}

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm font-semibold text-mint-deep" data-testid="privacy">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          100% Local Processing — Your text never leaves your browser.
        </p>
      </main>

      <footer className="border-t border-line/80 py-5 text-center text-xs text-muted">
        <p>
          <span className="font-bold text-ink">Shim</span> · Small Lists, Smooth Rides. · v{__APP_VERSION__} ·{' '}
          <button type="button" className="underline decoration-dotted underline-offset-2 hover:text-ink" onClick={() => setAboutOpen(true)}>
            About &amp; privacy
          </button>
        </p>
      </footer>

      <div aria-live="polite" role="status" className="sr-only" data-testid="announcer">
        {announce}
      </div>
      {announce && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-3">
          <span key={announce} className="animate-fade-up rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-pop">
            {announce}
          </span>
        </div>
      )}

      {showUpdate && (
        <UpdateBanner
          updating={status.updating}
          error={status.updateError}
          hasText={input.length > 0}
          onLater={() => setUpdateDismissed(true)}
          onUpdate={() => void status.applyUpdate(() => stashForUpdate(input))}
        />
      )}

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} statusText={statusLabel(status)} />
    </div>
  );
}
