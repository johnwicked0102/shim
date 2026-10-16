import { DEFAULT_OPTIONS, type ConvertOptions } from './convert';

/**
 * Local persistence for *preferences only*. User text is never written to
 * localStorage. The single exception is a one-shot handoff in
 * sessionStorage when the user explicitly confirms an app update, so the
 * reload does not lose their work; it is read and deleted immediately on
 * the next load and never leaves this tab.
 */

export type Theme = 'light' | 'dark' | 'system';

const PREFS_KEY = 'shim:prefs:v1';
const THEME_KEY = 'shim:theme';
const HANDOFF_KEY = 'shim:update-handoff';

/** Formatting keys that are safe to persist (no user content). */
const PERSISTABLE: Array<keyof ConvertOptions> = Object.keys(DEFAULT_OPTIONS) as Array<keyof ConvertOptions>;

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, key: string, value: string) {
  try {
    store?.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — preferences just won't persist */
  }
}
function safeRemove(store: Storage | undefined, key: string) {
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

const local = typeof window !== 'undefined' ? (() => { try { return window.localStorage; } catch { return undefined; } })() : undefined;
const session = typeof window !== 'undefined' ? (() => { try { return window.sessionStorage; } catch { return undefined; } })() : undefined;

export function loadOptions(): ConvertOptions {
  const raw = safeGet(local, PREFS_KEY);
  if (!raw) return { ...DEFAULT_OPTIONS };
  try {
    const parsed = JSON.parse(raw) as Partial<ConvertOptions>;
    const out = { ...DEFAULT_OPTIONS };
    for (const k of PERSISTABLE) {
      if (k in parsed && typeof parsed[k] === typeof DEFAULT_OPTIONS[k]) {
        (out as Record<string, unknown>)[k] = parsed[k];
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(opts: ConvertOptions) {
  const subset: Partial<ConvertOptions> = {};
  for (const k of PERSISTABLE) (subset as Record<string, unknown>)[k] = opts[k];
  safeSet(local, PREFS_KEY, JSON.stringify(subset));
}

export function loadTheme(): Theme {
  const t = safeGet(local, THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'system';
}
export function saveTheme(t: Theme) {
  if (t === 'system') safeRemove(local, THEME_KEY);
  else safeSet(local, THEME_KEY, t);
}

/** Stash the current input right before an update reload the user approved. */
export function stashForUpdate(input: string) {
  if (input) safeSet(session, HANDOFF_KEY, input);
}
/** Read-and-delete the update handoff. */
export function takeUpdateStash(): string | null {
  const v = safeGet(session, HANDOFF_KEY);
  if (v !== null) safeRemove(session, HANDOFF_KEY);
  return v;
}
