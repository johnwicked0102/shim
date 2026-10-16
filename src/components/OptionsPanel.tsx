import { RotateCcw } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import {
  escapeVisible,
  unescapeVisible,
  type CaseMode,
  type ColumnMode,
  type ConvertOptions,
  type EscapeMode,
  type InputDelimiter,
  type SortMode,
} from '../lib/convert';
import { PRESETS, matchPreset } from '../lib/presets';

interface Props {
  options: ConvertOptions;
  onChange: (patch: Partial<ConvertOptions>) => void;
  onReset: () => void;
  columnsDetected: number;
  detectedDelimiter: InputDelimiter | null;
  /** Single-column layout for the narrow sidebar. */
  compact?: boolean;
}

const SEPARATORS: Array<[string, string]> = [
  [', ', 'Comma + Space'],
  [',', 'Comma'],
  ['; ', 'Semicolon + Space'],
  [';', 'Semicolon'],
  [' | ', 'Pipe'],
  [' ', 'Space'],
  ['\t', 'Tab'],
  ['\n', 'New Line'],
];

const SPLITS: Array<[string, string]> = [
  [',', 'Commas'],
  [';', 'Semicolons'],
  ['|', 'Pipes'],
  [' ', 'Spaces'],
  ['\t', 'Tabs'],
  ['\n', 'New lines'],
];

const QUOTES: Array<[string, string, string]> = [
  ['', '', 'None'],
  ["'", "'", "Single  'a'"],
  ['"', '"', 'Double  "a"'],
  ['`', '`', 'Backtick  `a`'],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-2xl border border-line p-4">
      <legend className="px-1 text-sm font-extrabold">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A text field that lets people type \n and \t as visible escapes. */
function EscapedText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={escapeVisible(value)}
        onChange={(e) => onChange(unescapeVisible(e.target.value))}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}

function Select<T extends string>({ label, value, onChange, items }: { label: string; value: T; onChange: (v: T) => void; items: Array<[T, string]> }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl p-1 hover:bg-well">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-10 rounded-full bg-line transition peer-checked:bg-mint-deep peer-focus-visible:ring-4 peer-focus-visible:ring-mint/60" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition peer-checked:translate-x-4" />
      </span>
      <span className="text-sm">
        <span className="font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function OptionsPanel({ options: o, onChange, onReset, columnsDetected, detectedDelimiter, compact = false }: Props) {
  const active = matchPreset(o);
  const toList = o.direction === 'toList';
  const sepIsPreset = SEPARATORS.some(([v]) => v === o.separator);
  const splitIsPreset = SPLITS.some(([v]) => v === o.splitOn);
  const quoteKey = QUOTES.find(([q, c]) => q === o.quote && (o.quoteClose === '' || o.quoteClose === c))?.[0];

  const quoteSelect = (
    <Select
      label="Quotes"
      value={quoteKey ?? '__custom'}
      onChange={(v) => {
        if (v === '__custom') return onChange({ quote: '«', quoteClose: '»' });
        const q = QUOTES.find(([k]) => k === v)!;
        onChange({ quote: q[0], quoteClose: '' });
      }}
      items={[...QUOTES.map(([k, , l]) => [k, l] as [string, string]), ['__custom', 'Custom…']]}
    />
  );

  return (
    <div className="space-y-4" id="options">
      <div>
        <p className="field-label" id="preset-label">
          Quick formats
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="preset-label">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={active?.id === p.id}
              title={p.hint}
              onClick={() => onChange(p.options)}
            >
              {p.label}
              {!compact && (
                <span className={`ml-1.5 hidden font-mono text-[0.72rem] font-normal sm:inline ${active?.id === p.id ? '' : 'text-muted'}`}>{p.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-4 ${compact ? '' : 'lg:grid-cols-3'}`}>
        {toList ? (
          <Section title="Format">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Separator"
                value={sepIsPreset ? o.separator : '__custom'}
                onChange={(v) => onChange({ separator: v === '__custom' ? ' / ' : v })}
                items={[...SEPARATORS, ['__custom', 'Custom…']]}
              />
              {sepIsPreset ? (
                quoteSelect
              ) : (
                <EscapedText label="Custom separator" value={o.separator} onChange={(v) => onChange({ separator: v })} placeholder="e.g. \n or ' / '" />
              )}
            </div>
            {!sepIsPreset && quoteSelect}
            {quoteKey === undefined && (
              <div className="grid grid-cols-2 gap-3">
                <EscapedText label="Open quote" value={o.quote} onChange={(v) => onChange({ quote: v })} />
                <EscapedText label="Close quote" value={o.quoteClose} onChange={(v) => onChange({ quoteClose: v })} />
              </div>
            )}
            <Select<EscapeMode>
              label="Escape quotes inside items"
              value={o.escape}
              onChange={(v) => onChange({ escape: v })}
              items={[
                ['none', 'Don’t escape'],
                ['backslash', 'Backslash  \\" (JSON, JS, Python)'],
                ['double', 'Double up  "" / \'\' (SQL, CSV)'],
              ]}
            />
          </Section>
        ) : (
          <Section title="Split list">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Items are separated by"
                value={splitIsPreset ? o.splitOn : '__custom'}
                onChange={(v) => onChange({ splitOn: v === '__custom' ? '/' : v })}
                items={[...SPLITS, ['__custom', 'Custom…']]}
              />
              {!splitIsPreset && <EscapedText label="Custom" value={o.splitOn} onChange={(v) => onChange({ splitOn: v })} />}
            </div>
            <Toggle label="Remove surrounding quotes" hint={`"apple" → apple`} checked={o.stripQuotes} onChange={(v) => onChange({ stripQuotes: v })} />
          </Section>
        )}

        <Section title={toList ? 'Wrap & tags' : 'Remove wrappers'}>
          <div className="grid grid-cols-2 gap-3">
            <EscapedText label="Before each item" value={o.itemPrefix} onChange={(v) => onChange({ itemPrefix: v })} placeholder="e.g. <li>" />
            <EscapedText label="After each item" value={o.itemSuffix} onChange={(v) => onChange({ itemSuffix: v })} placeholder="e.g. </li>" />
            <EscapedText label="Start of list" value={o.wrapStart} onChange={(v) => onChange({ wrapStart: v })} placeholder="e.g. (" />
            <EscapedText label="End of list" value={o.wrapEnd} onChange={(v) => onChange({ wrapEnd: v })} placeholder="e.g. )" />
          </div>
          {toList && (
            <div>
              <label className="field-label" htmlFor="every">
                New line every N items
              </label>
              <input
                id="every"
                type="number"
                min={0}
                max={100000}
                inputMode="numeric"
                className="input font-sans"
                value={o.lineBreakEvery || ''}
                placeholder="Off"
                onChange={(e) => onChange({ lineBreakEvery: Math.max(0, Math.min(100000, Number(e.target.value) || 0)) })}
              />
            </div>
          )}
        </Section>

        <Section title="Clean up">
          <div className="grid gap-1">
            <Toggle label="Trim spaces" checked={o.trim} onChange={(v) => onChange({ trim: v })} />
            <Toggle label="Skip empty lines" checked={o.removeEmpty} onChange={(v) => onChange({ removeEmpty: v })} />
            <Toggle label="Remove duplicates" checked={o.removeDuplicates} onChange={(v) => onChange({ removeDuplicates: v })} />
            {o.removeDuplicates && (
              <div className="pl-6">
                <Toggle label="Ignore letter case" hint="Apple = apple" checked={o.dedupeIgnoreCase} onChange={(v) => onChange({ dedupeIgnoreCase: v })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select<SortMode>
              label="Order"
              value={o.sort}
              onChange={(v) => onChange({ sort: v })}
              items={[
                ['none', 'As entered'],
                ['asc', 'A → Z'],
                ['desc', 'Z → A'],
                ['natural', 'Natural (2 < 10)'],
                ['length', 'Shortest first'],
                ['reverse', 'Reversed'],
              ]}
            />
            <Select<CaseMode>
              label="Letter case"
              value={o.caseMode}
              onChange={(v) => onChange({ caseMode: v })}
              items={[
                ['none', 'Keep'],
                ['lower', 'lowercase'],
                ['upper', 'UPPERCASE'],
                ['title', 'Title Case'],
                ['sentence', 'Sentence case'],
              ]}
            />
          </div>
        </Section>
      </div>

      {toList && (
        <Section title="Multiple columns">
          <p className="text-xs text-muted" aria-live="polite">
            {columnsDetected > 1
              ? `Found ${columnsDetected} columns${detectedDelimiter ? ` (${detectedDelimiter === 'tab' ? 'tab' : detectedDelimiter}-separated)` : ''}.`
              : 'Paste straight from a spreadsheet — tab-separated columns are detected automatically.'}
          </p>
          <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            <Select<InputDelimiter>
              label="Columns are split by"
              value={o.inputDelimiter}
              onChange={(v) => onChange({ inputDelimiter: v })}
              items={[
                ['auto', 'Detect automatically'],
                ['none', 'Nothing (one item per line)'],
                ['tab', 'Tabs (spreadsheet)'],
                ['comma', 'Commas (CSV)'],
                ['semicolon', 'Semicolons'],
                ['pipe', 'Pipes'],
              ]}
            />
            <Select<ColumnMode>
              label="Combine cells"
              value={o.columnMode}
              onChange={(v) => onChange({ columnMode: v })}
              items={[
                ['flatten', 'All cells, row by row'],
                ['byColumn', 'All cells, column by column'],
                ['rows', 'One line per row'],
                ['pick', 'Only one column'],
              ]}
            />
            {o.columnMode === 'pick' && (
              <div>
                <label className="field-label" htmlFor="pickcol">
                  Column number
                </label>
                <input
                  id="pickcol"
                  type="number"
                  min={1}
                  max={Math.max(1, columnsDetected || 1000)}
                  className="input font-sans"
                  value={o.pickColumn}
                  onChange={(e) => onChange({ pickColumn: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
            )}
            <div className="flex items-end">
              <Toggle label="First line is a header" checked={o.skipHeader} onChange={(v) => onChange({ skipHeader: v })} />
            </div>
          </div>
        </Section>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-ghost py-2 text-sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset options
        </button>
      </div>
    </div>
  );
}
