/**
 * Shim conversion engine.
 *
 * Pure, synchronous, dependency-free functions. Everything runs in browser
 * memory — nothing here touches the network, storage or the DOM.
 */

export type Direction = 'toList' | 'toColumn';
export type InputDelimiter = 'auto' | 'none' | 'tab' | 'comma' | 'semicolon' | 'pipe';
export type ColumnMode = 'flatten' | 'byColumn' | 'rows' | 'pick';
export type SortMode = 'none' | 'asc' | 'desc' | 'natural' | 'length' | 'reverse';
export type CaseMode = 'none' | 'lower' | 'upper' | 'title' | 'sentence';
export type EscapeMode = 'none' | 'backslash' | 'double';

export interface ConvertOptions {
  direction: Direction;
  /** Text placed between items (supports \n and \t escapes in the UI). */
  separator: string;
  /** How a single line is split into cells when the input has several columns. */
  inputDelimiter: InputDelimiter;
  /** What to do with multi-column input. */
  columnMode: ColumnMode;
  /** 1-based column used when columnMode === 'pick'. */
  pickColumn: number;
  /** Skip the first line (header row). */
  skipHeader: boolean;
  trim: boolean;
  removeEmpty: boolean;
  removeDuplicates: boolean;
  dedupeIgnoreCase: boolean;
  sort: SortMode;
  caseMode: CaseMode;
  /** Opening quote placed before each item. */
  quote: string;
  /** Closing quote; defaults to `quote` when empty. */
  quoteClose: string;
  escape: EscapeMode;
  /** Text before / after each item (e.g. `<li>` / `</li>`). */
  itemPrefix: string;
  itemSuffix: string;
  /** Text before / after the whole result (e.g. `(` / `)` or `[` / `]`). */
  wrapStart: string;
  wrapEnd: string;
  /** Insert a newline after every N items (0 = never). */
  lineBreakEvery: number;
  /** toColumn: separator used to split the input list. */
  splitOn: string;
  /** toColumn: remove one matching layer of surrounding quotes from items. */
  stripQuotes: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  direction: 'toList',
  separator: ', ',
  inputDelimiter: 'auto',
  columnMode: 'flatten',
  pickColumn: 1,
  skipHeader: false,
  trim: true,
  removeEmpty: true,
  removeDuplicates: false,
  dedupeIgnoreCase: false,
  sort: 'none',
  caseMode: 'none',
  quote: '',
  quoteClose: '',
  escape: 'none',
  itemPrefix: '',
  itemSuffix: '',
  wrapStart: '',
  wrapEnd: '',
  lineBreakEvery: 0,
  splitOn: ',',
  stripQuotes: true,
};

export interface ConvertResult {
  output: string;
  /** The cleaned items (before quoting/wrapping) — used for JSON export. */
  items: string[];
  /** Number of items in the result. */
  count: number;
  /** Number of items before cleanup (empty removal / dedupe). */
  inputCount: number;
  duplicatesRemoved: number;
  emptyRemoved: number;
  /** Detected/used delimiter for multi-column input, if any. */
  detectedDelimiter: InputDelimiter | null;
  columns: number;
}

const DELIMS: Record<Exclude<InputDelimiter, 'auto' | 'none'>, string> = {
  tab: '\t',
  comma: ',',
  semicolon: ';',
  pipe: '|',
};

/** Normalise CRLF / CR line endings and strip a UTF-8 BOM. */
export function normalizeNewlines(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

/** Turn the user's visible escape sequences into real characters. */
export function unescapeVisible(s: string): string {
  return s.replace(/\\(n|t|r|\\)/g, (_, c: string) =>
    c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : '\\',
  );
}

/** Reverse of unescapeVisible — used when showing separators in inputs. */
export function escapeVisible(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
}

/**
 * Detect a column delimiter. Tabs (spreadsheet paste) win; otherwise a
 * delimiter only counts when it appears consistently on most lines.
 */
export function detectDelimiter(lines: string[]): InputDelimiter {
  const sample = lines.filter((l) => l.trim() !== '').slice(0, 200);
  if (sample.length === 0) return 'none';
  if (sample.some((l) => l.includes('\t'))) return 'tab';
  if (sample.length < 2) return 'none';
  for (const key of ['pipe', 'semicolon', 'comma'] as const) {
    const ch = DELIMS[key];
    const counts = sample.map((l) => splitDelimited(l, ch).length - 1);
    const withDelim = counts.filter((c) => c > 0).length;
    const first = counts[0];
    const consistent = counts.filter((c) => c === first).length;
    if (first > 0 && withDelim === sample.length && consistent / sample.length >= 0.8) return key;
  }
  return 'none';
}

/**
 * Split one line on a delimiter, honouring RFC-4180 style double quotes
 * (`"a, b",c` → [`a, b`, `c`], `""` → `"`).
 */
export function splitDelimited(line: string, delim: string): string[] {
  if (delim === '\t' || !line.includes('"')) return line.split(delim);
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"' && cur.trim() === '') {
      inQuotes = true;
      cur = '';
    } else if (line.startsWith(delim, i)) {
      cells.push(cur);
      cur = '';
      i += delim.length - 1;
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-_/(])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

export function applyCase(s: string, mode: CaseMode): string {
  switch (mode) {
    case 'lower':
      return s.toLowerCase();
    case 'upper':
      return s.toUpperCase();
    case 'title':
      return toTitle(s);
    case 'sentence': {
      const lower = s.toLowerCase();
      return lower.replace(/\p{L}/u, (c) => c.toUpperCase());
    }
    default:
      return s;
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const plainCollator = new Intl.Collator(undefined, { sensitivity: 'variant' });

export function sortItems(items: string[], mode: SortMode): string[] {
  const out = [...items];
  switch (mode) {
    case 'asc':
      return out.sort(plainCollator.compare);
    case 'desc':
      return out.sort((a, b) => plainCollator.compare(b, a));
    case 'natural':
      return out.sort(collator.compare);
    case 'length':
      return out.sort((a, b) => a.length - b.length || collator.compare(a, b));
    case 'reverse':
      return out.reverse();
    default:
      return out;
  }
}

export function escapeItem(item: string, quote: string, quoteClose: string, mode: EscapeMode): string {
  if (mode === 'none') return item;
  const chars = Array.from(new Set([quote, quoteClose].filter((q) => q.length > 0)));
  if (mode === 'backslash') {
    let s = item.replace(/\\/g, '\\\\');
    for (const q of chars) s = s.split(q).join('\\' + q);
    return s.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
  }
  // 'double' — SQL / CSV style: ' → ''  " → ""
  let s = item;
  for (const q of chars) s = s.split(q).join(q + q);
  return s;
}

/** Extract items from the input according to the column options. */
export function extractItems(
  text: string,
  opts: Pick<ConvertOptions, 'inputDelimiter' | 'columnMode' | 'pickColumn' | 'skipHeader' | 'separator'>,
): { items: string[]; delimiter: InputDelimiter | null; columns: number } {
  let lines = normalizeNewlines(text).split('\n');
  // A single trailing newline (very common when pasting) is not an item.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  if (opts.skipHeader) lines = lines.slice(1);

  const delimiter = opts.inputDelimiter === 'auto' ? detectDelimiter(lines) : opts.inputDelimiter;
  if (delimiter === 'none') return { items: lines, delimiter: null, columns: 1 };

  const ch = DELIMS[delimiter as keyof typeof DELIMS];
  const rows = lines.map((l) => splitDelimited(l, ch));
  const columns = rows.reduce((m, r) => Math.max(m, r.length), 0);

  switch (opts.columnMode) {
    case 'pick': {
      const idx = Math.max(1, Math.floor(opts.pickColumn)) - 1;
      return { items: rows.map((r) => r[idx] ?? ''), delimiter, columns };
    }
    case 'byColumn': {
      const items: string[] = [];
      for (let c = 0; c < columns; c++) for (const r of rows) if (c < r.length) items.push(r[c]);
      return { items, delimiter, columns };
    }
    case 'rows':
      // Each row is kept together; its cells are joined with the output separator.
      return { items: rows.map((r) => r.map((c) => c.trim()).join(opts.separator)), delimiter, columns };
    default:
      return { items: rows.flat(), delimiter, columns };
  }
}

function stripOneQuoteLayer(s: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ];
  for (const [o, c] of pairs) {
    if (s.length >= 2 && s.startsWith(o) && s.endsWith(c)) return s.slice(1, -1);
  }
  return s;
}

/** Shared cleanup pipeline used by both directions. */
function cleanItems(raw: string[], opts: ConvertOptions) {
  let items = raw.map((s) => (opts.trim ? s.trim() : s));
  let emptyRemoved = 0;
  if (opts.removeEmpty) {
    const before = items.length;
    items = items.filter((s) => s.trim() !== '');
    emptyRemoved = before - items.length;
  }
  items = items.map((s) => applyCase(s, opts.caseMode));
  let duplicatesRemoved = 0;
  if (opts.removeDuplicates) {
    const seen = new Set<string>();
    const before = items.length;
    items = items.filter((s) => {
      const key = opts.dedupeIgnoreCase ? s.toLocaleLowerCase() : s;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    duplicatesRemoved = before - items.length;
  }
  items = sortItems(items, opts.sort);
  return { items, emptyRemoved, duplicatesRemoved };
}

/** Column → delimited list. */
export function columnToList(text: string, options: Partial<ConvertOptions> = {}): ConvertResult {
  const opts: ConvertOptions = { ...DEFAULT_OPTIONS, ...options };
  if (text === '') {
    return { output: '', items: [], count: 0, inputCount: 0, duplicatesRemoved: 0, emptyRemoved: 0, detectedDelimiter: null, columns: 0 };
  }
  const { items: raw, delimiter, columns } = extractItems(text, opts);
  const { items, emptyRemoved, duplicatesRemoved } = cleanItems(raw, opts);

  const close = opts.quoteClose !== '' ? opts.quoteClose : opts.quote;
  const formatted = items.map(
    (it) => opts.itemPrefix + opts.quote + escapeItem(it, opts.quote, close, opts.escape) + close + opts.itemSuffix,
  );

  let body: string;
  const every = Math.floor(opts.lineBreakEvery);
  if (every > 0 && formatted.length > every) {
    const chunks: string[] = [];
    for (let i = 0; i < formatted.length; i += every) chunks.push(formatted.slice(i, i + every).join(opts.separator));
    // Keep the separator at the end of each line (minus trailing spaces) so the list stays valid.
    const lineSep = opts.separator.replace(/[ ]+$/, '');
    body = chunks.join(lineSep.includes('\n') ? lineSep : lineSep + '\n');
  } else {
    body = formatted.join(opts.separator);
  }

  return {
    output: items.length ? opts.wrapStart + body + opts.wrapEnd : '',
    items,
    count: items.length,
    inputCount: raw.length,
    duplicatesRemoved,
    emptyRemoved,
    detectedDelimiter: delimiter,
    columns,
  };
}

/** Delimited list → column (one item per line). */
export function listToColumn(text: string, options: Partial<ConvertOptions> = {}): ConvertResult {
  const opts: ConvertOptions = { ...DEFAULT_OPTIONS, ...options };
  if (text === '') {
    return { output: '', items: [], count: 0, inputCount: 0, duplicatesRemoved: 0, emptyRemoved: 0, detectedDelimiter: null, columns: 0 };
  }
  let src = normalizeNewlines(text).trim();
  // Remove an enclosing wrapper such as [..] or (..) when it matches the configured one.
  if (opts.wrapStart && src.startsWith(opts.wrapStart)) src = src.slice(opts.wrapStart.length);
  if (opts.wrapEnd && src.endsWith(opts.wrapEnd)) src = src.slice(0, src.length - opts.wrapEnd.length);

  const sep = opts.splitOn === '' ? ',' : opts.splitOn;
  const raw =
    sep === '\n'
      ? src.split('\n')
      : src
          .split('\n')
          .flatMap((line) => splitDelimited(line, sep))
          // Lines that wrap with a trailing separator produce empty cells — those are not items.
          .filter((s, i, arr) => !(s.trim() === '' && i === arr.length - 1 && arr.length > 1));

  let pieces = raw.map((s) => (opts.trim ? s.trim() : s));
  if (opts.itemPrefix || opts.itemSuffix) {
    pieces = pieces.map((s) => {
      let r = s;
      if (opts.itemPrefix && r.startsWith(opts.itemPrefix)) r = r.slice(opts.itemPrefix.length);
      if (opts.itemSuffix && r.endsWith(opts.itemSuffix)) r = r.slice(0, r.length - opts.itemSuffix.length);
      return r;
    });
  }
  if (opts.stripQuotes) pieces = pieces.map((s) => stripOneQuoteLayer(opts.trim ? s.trim() : s));

  const { items, emptyRemoved, duplicatesRemoved } = cleanItems(pieces, { ...opts, quote: '' });
  return {
    output: items.join('\n'),
    items,
    count: items.length,
    inputCount: raw.length,
    duplicatesRemoved,
    emptyRemoved,
    detectedDelimiter: null,
    columns: 1,
  };
}

export function convert(text: string, options: Partial<ConvertOptions> = {}): ConvertResult {
  return (options.direction ?? DEFAULT_OPTIONS.direction) === 'toColumn'
    ? listToColumn(text, options)
    : columnToList(text, options);
}
