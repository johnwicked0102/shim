import { describe, expect, it } from 'vitest';
import {
  applyCase,
  columnToList,
  convert,
  detectDelimiter,
  escapeItem,
  escapeVisible,
  listToColumn,
  normalizeNewlines,
  sortItems,
  splitDelimited,
  unescapeVisible,
} from '../src/lib/convert';
import { PRESETS, describeSeparator, matchPreset } from '../src/lib/presets';
import { DEFAULT_OPTIONS } from '../src/lib/convert';

const preset = (id: string) => PRESETS.find((p) => p.id === id)!.options;

describe('columnToList — basics', () => {
  it('matches the reference example', () => {
    expect(columnToList('Apple\nBanana\nCherry\nMango').output).toBe('Apple, Banana, Cherry, Mango');
  });
  it('returns empty output for empty input', () => {
    const r = columnToList('');
    expect(r.output).toBe('');
    expect(r.count).toBe(0);
  });
  it('handles CRLF, CR and a BOM', () => {
    expect(columnToList('﻿a\r\nb\rc').output).toBe('a, b, c');
  });
  it('ignores a trailing newline and skips blank lines by default', () => {
    const r = columnToList('a\n\n  \nb\n');
    expect(r.output).toBe('a, b');
    expect(r.emptyRemoved).toBe(2);
  });
  it('keeps blank items when asked', () => {
    expect(columnToList('a\n\nb', { removeEmpty: false }).output).toBe('a, , b');
  });
  it('trims by default and can preserve whitespace', () => {
    expect(columnToList('  a  \n b').output).toBe('a, b');
    expect(columnToList('  a  \n b', { trim: false }).output).toBe('  a  ,  b');
  });
  it('supports any separator including newline and tab', () => {
    expect(columnToList('a\nb', { separator: ';' }).output).toBe('a;b');
    expect(columnToList('a\nb', { separator: '\t' }).output).toBe('a\tb');
    expect(columnToList('a\nb', { separator: ' / ' }).output).toBe('a / b');
  });
  it('preserves unicode and emoji', () => {
    expect(columnToList('café\n🚲\n日本').output).toBe('café, 🚲, 日本');
  });
  it('handles a single item without wrapping it oddly', () => {
    expect(columnToList('solo', preset('sql-in')).output).toBe("('solo')");
  });
});

describe('quoting, escaping and wrapping', () => {
  it('SQL IN preset doubles single quotes', () => {
    expect(columnToList("O'Brien\nSmith", preset('sql-in')).output).toBe("('O''Brien', 'Smith')");
  });
  it('JSON preset produces valid JSON', () => {
    const out = columnToList('say "hi"\nback\\slash\nplain', preset('json')).output;
    expect(JSON.parse(out)).toEqual(['say "hi"', 'back\\slash', 'plain']);
  });
  it('quoted CSV preset doubles double quotes', () => {
    expect(columnToList('a"b\nc', preset('csv-quoted')).output).toBe('"a""b","c"');
  });
  it('supports asymmetric custom quotes', () => {
    expect(columnToList('a\nb', { quote: '«', quoteClose: '»' }).output).toBe('«a», «b»');
  });
  it('wraps items with HTML tags', () => {
    expect(columnToList('a\nb', preset('html-list')).output).toBe('<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>');
  });
  it('markdown and hashtag presets', () => {
    expect(columnToList('a\nb', preset('markdown')).output).toBe('- a\n- b');
    expect(columnToList('a\nb', preset('hashtags')).output).toBe('#a #b');
  });
  it('escapeItem none / backslash / double', () => {
    expect(escapeItem('a"b', '"', '"', 'none')).toBe('a"b');
    expect(escapeItem('a"b\n', '"', '"', 'backslash')).toBe('a\\"b\\n');
    expect(escapeItem("it's", "'", "'", 'double')).toBe("it''s");
  });
  it('inserts a line break every N items while keeping separators', () => {
    expect(columnToList('1\n2\n3\n4\n5', { lineBreakEvery: 2 }).output).toBe('1, 2,\n3, 4,\n5');
  });
  it('line break every N does nothing when the list is short', () => {
    expect(columnToList('1\n2', { lineBreakEvery: 5 }).output).toBe('1, 2');
  });
});

describe('cleanup: duplicates, sorting, case', () => {
  it('removes exact duplicates keeping first occurrence', () => {
    const r = columnToList('b\na\nb\nA', { removeDuplicates: true });
    expect(r.output).toBe('b, a, A');
    expect(r.duplicatesRemoved).toBe(1);
  });
  it('removes case-insensitive duplicates', () => {
    expect(columnToList('Apple\napple\nAPPLE\nPear', { removeDuplicates: true, dedupeIgnoreCase: true }).output).toBe('Apple, Pear');
  });
  it('sorts A→Z, Z→A, natural, length and reversed', () => {
    const items = ['item10', 'item2', 'Banana', 'apple'];
    expect(sortItems(items, 'asc')).toEqual(['apple', 'Banana', 'item10', 'item2']);
    expect(sortItems(items, 'desc')).toEqual(['item2', 'item10', 'Banana', 'apple']);
    expect(sortItems(items, 'natural')).toEqual(['apple', 'Banana', 'item2', 'item10']);
    expect(sortItems(['ccc', 'a', 'bb'], 'length')).toEqual(['a', 'bb', 'ccc']);
    expect(sortItems(['1', '2', '3'], 'reverse')).toEqual(['3', '2', '1']);
    expect(sortItems(items, 'none')).toEqual(items);
  });
  it('dedupe happens after case transform', () => {
    expect(columnToList('a\nA', { caseMode: 'upper', removeDuplicates: true }).output).toBe('A');
  });
  it('case transforms', () => {
    expect(applyCase('hello WORLD', 'lower')).toBe('hello world');
    expect(applyCase('hello world', 'upper')).toBe('HELLO WORLD');
    expect(applyCase('hello wide-world', 'title')).toBe('Hello Wide-World');
    expect(applyCase('HELLO world', 'sentence')).toBe('Hello world');
    expect(applyCase('Same', 'none')).toBe('Same');
  });
});

describe('multiple columns', () => {
  const sheet = 'Name\tCity\nAda\tLondon\nLinus\tHelsinki';

  it('auto-detects tab-separated spreadsheet paste and flattens row by row', () => {
    const r = columnToList(sheet, { skipHeader: true });
    expect(r.detectedDelimiter).toBe('tab');
    expect(r.columns).toBe(2);
    expect(r.output).toBe('Ada, London, Linus, Helsinki');
  });
  it('flattens column by column', () => {
    expect(columnToList(sheet, { skipHeader: true, columnMode: 'byColumn' }).output).toBe('Ada, Linus, London, Helsinki');
  });
  it('picks a single column', () => {
    expect(columnToList(sheet, { skipHeader: true, columnMode: 'pick', pickColumn: 2 }).output).toBe('London, Helsinki');
  });
  it('keeps rows together (one line per row)', () => {
    expect(columnToList(sheet, { columnMode: 'rows', separator: ', ' }).output).toBe('Name, City, Ada, London, Linus, Helsinki');
    expect(columnToList(sheet, { columnMode: 'rows', separator: '\n' }).output).toBe('Name\nCity\nAda\nLondon\nLinus\nHelsinki');
  });
  it('handles ragged rows and out-of-range column picks', () => {
    const r = columnToList('a\tb\tc\nd', { columnMode: 'pick', pickColumn: 3 });
    expect(r.output).toBe('c');
    expect(r.columns).toBe(3);
  });
  it('parses quoted CSV cells with embedded commas', () => {
    const csv = 'id,name\n1,"Smith, John"\n2,"Doe ""JD"" Jane"';
    const r = columnToList(csv, { inputDelimiter: 'comma', columnMode: 'pick', pickColumn: 2, skipHeader: true, separator: ' | ' });
    expect(r.output).toBe('Smith, John | Doe "JD" Jane');
  });
  it('auto-detects consistent CSV but not prose with commas', () => {
    expect(detectDelimiter(['a,b', 'c,d', 'e,f'])).toBe('comma');
    expect(detectDelimiter(['Hello, world', 'No commas here'])).toBe('none');
    expect(detectDelimiter(['single line, with comma'])).toBe('none');
    expect(detectDelimiter(['a|b', 'c|d'])).toBe('pipe');
    expect(detectDelimiter([])).toBe('none');
  });
  it('explicit "none" treats each line as one item even with tabs', () => {
    expect(columnToList('a\tb\nc', { inputDelimiter: 'none' }).output).toBe('a\tb, c');
  });
  it('splitDelimited honours quotes and multi-char delimiters', () => {
    expect(splitDelimited('"a,b",c', ',')).toEqual(['a,b', 'c']);
    expect(splitDelimited('a::b', '::')).toEqual(['a', 'b']);
    expect(splitDelimited('x\ty', '\t')).toEqual(['x', 'y']);
  });
});

describe('listToColumn (reverse)', () => {
  it('splits a comma list into lines', () => {
    expect(listToColumn('Apple, Banana, Cherry').output).toBe('Apple\nBanana\nCherry');
  });
  it('strips quotes and wrappers from SQL/JSON style lists', () => {
    expect(listToColumn('("a", "b", "c")', { wrapStart: '(', wrapEnd: ')' }).output).toBe('a\nb\nc');
    expect(listToColumn("['x', 'y']", { wrapStart: '[', wrapEnd: ']' }).output).toBe('x\ny');
  });
  it('keeps commas inside double-quoted items', () => {
    expect(listToColumn('"Smith, John", Jane').output).toBe('Smith, John\nJane');
  });
  it('handles multi-line lists produced with line breaks', () => {
    expect(listToColumn('1, 2,\n3, 4,\n5').output).toBe('1\n2\n3\n4\n5');
  });
  it('splits on other separators and removes item tags', () => {
    expect(listToColumn('a|b|c', { splitOn: '|' }).output).toBe('a\nb\nc');
    expect(listToColumn('#a #b', { splitOn: ' ', itemPrefix: '#' }).output).toBe('a\nb');
  });
  it('round-trips through the convert() dispatcher', () => {
    const items = 'one\ntwo\nthree';
    const list = convert(items, { direction: 'toList', ...preset('json') }).output;
    const back = convert(list, { direction: 'toColumn', wrapStart: '[', wrapEnd: ']', splitOn: ',' }).output;
    expect(back).toBe(items);
  });
  it('applies dedupe and sort in reverse mode too', () => {
    expect(listToColumn('b, a, b', { removeDuplicates: true, sort: 'asc' }).output).toBe('a\nb');
  });
});

describe('helpers', () => {
  it('normalizes newlines', () => {
    expect(normalizeNewlines('a\r\nb\rc')).toBe('a\nb\nc');
  });
  it('visible escapes round-trip', () => {
    for (const s of ['\n', '\t', ', ', 'a\\b', '\r\n']) expect(unescapeVisible(escapeVisible(s))).toBe(s);
  });
  it('describes separators', () => {
    expect(describeSeparator(', ')).toBe('Comma + Space');
    expect(describeSeparator('\n')).toBe('New Line');
    expect(describeSeparator('::')).toBe('“::”');
  });
  it('matches the active preset', () => {
    expect(matchPreset({ ...DEFAULT_OPTIONS })?.id).toBe('comma-space');
    expect(matchPreset({ ...DEFAULT_OPTIONS, ...preset('sql-in') })?.id).toBe('sql-in');
    expect(matchPreset({ ...DEFAULT_OPTIONS, separator: '~~' })).toBeUndefined();
  });
  it('every preset produces non-empty output', () => {
    for (const p of PRESETS) expect(convert('a\nb', { ...DEFAULT_OPTIONS, ...p.options }).count).toBe(2);
  });
});

describe('performance', () => {
  it('converts 200,000 lines quickly', () => {
    const big = Array.from({ length: 200_000 }, (_, i) => `item-${i % 50_000}`).join('\n');
    const t = performance.now();
    const r = columnToList(big, { removeDuplicates: true, sort: 'natural' });
    const ms = performance.now() - t;
    expect(r.count).toBe(50_000);
    expect(ms).toBeLessThan(3000);
  });
});
