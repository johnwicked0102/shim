/** Local file import/export helpers. Nothing is uploaded anywhere. */

export const ACCEPTED_EXTENSIONS = ['.txt', '.csv', '.tsv', '.text', '.list', '.md', '.json', '.log'];
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // 25 MB keeps the tab responsive

export class ImportError extends Error {}

export function isAcceptedFile(file: Pick<File, 'name' | 'type'>): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/csv';
}

/** Read a local File into a string (UTF-8, falling back to Windows-1252 on invalid bytes). */
export async function readTextFile(file: File): Promise<string> {
  if (!isAcceptedFile(file)) throw new ImportError(`“${file.name}” isn't a text file. Try TXT, CSV or TSV.`);
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(`“${file.name}” is larger than 25 MB.`);
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export type ExportFormat = 'txt' | 'csv' | 'json';

const MIME: Record<ExportFormat, string> = {
  txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

/** Build the content for an export format. JSON exports the items as a real array. */
export function buildExport(format: ExportFormat, output: string, items: string[]): string {
  if (format === 'json') return JSON.stringify(items, null, 2) + '\n';
  return output;
}

/** Trigger a browser download from in-memory data via a Blob URL. */
export function downloadText(content: string, filename: string, format: ExportFormat) {
  const blob = new Blob([content], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has had a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportFilename(format: ExportFormat, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `shim-${stamp}.${format}`;
}

/** Copy text: async Clipboard API first, then a selection-based fallback (works offline & on http dev hosts). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function readClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
  } catch {
    /* permission denied or unsupported */
  }
  return null;
}
