import type { ConvertOptions } from './convert';

export interface Preset {
  id: string;
  label: string;
  hint: string;
  options: Partial<ConvertOptions>;
}

/** Formatting fields every preset resets so presets never "stack". */
const RESET: Partial<ConvertOptions> = {
  direction: 'toList',
  quote: '',
  quoteClose: '',
  escape: 'none',
  itemPrefix: '',
  itemSuffix: '',
  wrapStart: '',
  wrapEnd: '',
  lineBreakEvery: 0,
};

export const PRESETS: Preset[] = [
  { id: 'comma-space', label: 'Comma + Space', hint: 'a, b, c', options: { ...RESET, separator: ', ' } },
  { id: 'comma', label: 'Comma', hint: 'a,b,c', options: { ...RESET, separator: ',' } },
  { id: 'semicolon', label: 'Semicolon', hint: 'a; b; c', options: { ...RESET, separator: '; ' } },
  { id: 'pipe', label: 'Pipe', hint: 'a | b | c', options: { ...RESET, separator: ' | ' } },
  { id: 'space', label: 'Space', hint: 'a b c', options: { ...RESET, separator: ' ' } },
  { id: 'tab', label: 'Tab', hint: 'a⇥b⇥c', options: { ...RESET, separator: '\t' } },
  {
    id: 'sql-in',
    label: 'SQL IN',
    hint: "('a', 'b')",
    options: { ...RESET, separator: ', ', quote: "'", escape: 'double', wrapStart: '(', wrapEnd: ')' },
  },
  {
    id: 'json',
    label: 'JSON Array',
    hint: '["a", "b"]',
    options: { ...RESET, separator: ', ', quote: '"', escape: 'backslash', wrapStart: '[', wrapEnd: ']' },
  },
  {
    id: 'python',
    label: 'Python List',
    hint: "['a', 'b']",
    options: { ...RESET, separator: ', ', quote: "'", escape: 'backslash', wrapStart: '[', wrapEnd: ']' },
  },
  {
    id: 'csv-quoted',
    label: 'Quoted CSV',
    hint: '"a","b"',
    options: { ...RESET, separator: ',', quote: '"', escape: 'double' },
  },
  {
    id: 'html-list',
    label: 'HTML List',
    hint: '<li>a</li>',
    options: { ...RESET, separator: '\n', itemPrefix: '  <li>', itemSuffix: '</li>', wrapStart: '<ul>\n', wrapEnd: '\n</ul>' },
  },
  {
    id: 'markdown',
    label: 'Markdown Bullets',
    hint: '- a',
    options: { ...RESET, separator: '\n', itemPrefix: '- ' },
  },
  {
    id: 'hashtags',
    label: 'Hashtags',
    hint: '#a #b',
    options: { ...RESET, separator: ' ', itemPrefix: '#' },
  },
  {
    id: 'to-column',
    label: 'List → Column',
    hint: 'a, b → lines',
    options: { ...RESET, direction: 'toColumn', splitOn: ',', stripQuotes: true },
  },
];

const PRESET_KEYS: Array<keyof ConvertOptions> = [
  'direction',
  'separator',
  'quote',
  'quoteClose',
  'escape',
  'itemPrefix',
  'itemSuffix',
  'wrapStart',
  'wrapEnd',
  'lineBreakEvery',
  'splitOn',
];

/** Find the preset that exactly matches the current formatting, if any. */
export function matchPreset(opts: ConvertOptions): Preset | undefined {
  return PRESETS.find((p) =>
    PRESET_KEYS.every((k) => {
      if (!(k in p.options)) return true;
      if (k === 'separator' && opts.direction === 'toColumn') return true;
      return p.options[k] === opts[k];
    }),
  );
}

export function describeSeparator(sep: string): string {
  const named: Record<string, string> = {
    ', ': 'Comma + Space',
    ',': 'Comma',
    '; ': 'Semicolon + Space',
    ';': 'Semicolon',
    ' | ': 'Pipe',
    '|': 'Pipe',
    ' ': 'Space',
    '\t': 'Tab',
    '\n': 'New Line',
    '': 'Nothing',
  };
  return named[sep] ?? `“${sep.replace(/\n/g, '↵').replace(/\t/g, '⇥')}”`;
}
