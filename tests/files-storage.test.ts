import { beforeEach, describe, expect, it } from 'vitest';
import { buildExport, exportFilename, isAcceptedFile, readTextFile } from '../src/lib/files';
import { loadOptions, saveOptions, stashForUpdate, takeUpdateStash } from '../src/lib/storage';
import { DEFAULT_OPTIONS } from '../src/lib/convert';

describe('file import', () => {
  it('accepts text-like files and rejects binaries', () => {
    expect(isAcceptedFile({ name: 'list.TXT', type: '' })).toBe(true);
    expect(isAcceptedFile({ name: 'data.csv', type: '' })).toBe(true);
    expect(isAcceptedFile({ name: 'noext', type: 'text/plain' })).toBe(true);
    expect(isAcceptedFile({ name: 'pic.png', type: 'image/png' })).toBe(false);
  });
  it('decodes UTF-8 and strips the BOM', async () => {
    const f = new File(['﻿café\n🚲'], 'a.txt', { type: 'text/plain' });
    expect(await readTextFile(f)).toBe('café\n🚲');
  });
  it('falls back to Windows-1252 for legacy Excel CSVs', async () => {
    const f = new File([new Uint8Array([0x63, 0x61, 0x66, 0xe9])], 'legacy.csv'); // "café" in cp1252
    expect(await readTextFile(f)).toBe('café');
  });
});

describe('export', () => {
  it('builds exports per format', () => {
    expect(buildExport('txt', 'a, b', ['a', 'b'])).toBe('a, b');
    expect(buildExport('csv', 'a,b', ['a', 'b'])).toBe('a,b');
    expect(JSON.parse(buildExport('json', '', ['a', 'b"c']))).toEqual(['a', 'b"c']);
  });
  it('names files with a timestamp', () => {
    expect(exportFilename('csv', new Date(2026, 9, 16, 9, 5))).toBe('shim-20261016-0905.csv');
  });
});

describe('preference storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it('round-trips formatting preferences', () => {
    saveOptions({ ...DEFAULT_OPTIONS, separator: ' | ', removeDuplicates: true });
    const o = loadOptions();
    expect(o.separator).toBe(' | ');
    expect(o.removeDuplicates).toBe(true);
  });
  it('ignores corrupted or wrongly-typed stored values', () => {
    localStorage.setItem('shim:prefs:v1', '{"separator":42,"trim":"yes"}');
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
    localStorage.setItem('shim:prefs:v1', 'not json');
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });
  it('update handoff is one-shot', () => {
    stashForUpdate('draft');
    expect(takeUpdateStash()).toBe('draft');
    expect(takeUpdateStash()).toBeNull();
  });
});
