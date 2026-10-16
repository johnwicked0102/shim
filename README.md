# 🚲 Shim

**Small Lists, Smooth Rides.**

Shim turns columns into comma-separated lists — and back again — entirely inside your browser. It is an offline-first Progressive Web App: after one visit it keeps working with no internet connection, and your text never leaves your device.

> **100% Local Processing — Your text never leaves your browser.**

---

## Features

**Conversion**
- Column → list and list → column (one-click swap, `Ctrl/⌘ + Shift + X`)
- Any separator: comma, comma + space, semicolon, pipe, space, tab, new line, or custom (type `\n` / `\t` for line breaks and tabs)
- Quotes: none, single, double, backtick, or custom open/close pairs (e.g. `«` `»`)
- Quote escaping: backslash (JSON / JS / Python) or doubled (SQL / CSV)
- Per-item prefix/suffix (HTML tags, `#`, `- `) and whole-list wrappers (`( )`, `[ ]`, `<ul>`)
- Line break every _N_ items
- **Multiple columns**: spreadsheet (tab), CSV (quote-aware), semicolon and pipe input is auto-detected; flatten row-by-row or column-by-column, keep rows together, or pick one column; optional header row skip
- Clean-up: trim, skip empty lines, remove duplicates (optionally case-insensitive), sort (A→Z, Z→A, natural, by length, reversed), letter case (lower, UPPER, Title, Sentence)

**Quick formats**: Comma + Space · Comma · Semicolon · Pipe · Space · Tab · SQL `IN` · JSON Array · Python List · Quoted CSV · HTML List · Markdown Bullets · Hashtags · List → Column

**Import / export** (all local): paste from clipboard, import or drag-and-drop TXT / CSV / TSV (UTF-8 with Windows-1252 fallback for legacy Excel files), copy result, download as TXT, CSV or JSON.

**Experience**: cream / mint / peach bicycle theme with light & dark modes, responsive from phones to desktops, keyboard shortcuts, reduced-motion support, WCAG 2.1 AA (verified with axe-core).

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + Enter` | Copy result |
| `Ctrl/⌘ + S` | Download result as TXT |
| `Ctrl/⌘ + O` | Import a file |
| `Ctrl/⌘ + Shift + X` | Swap direction |

---

## Architecture

Zero backend. Vercel only serves static files.

| Concern | Implementation |
| --- | --- |
| UI | React 18 + TypeScript, Tailwind CSS, Lucide icons, original SVG bicycle art |
| Build | Vite 8 → static `dist/` |
| Offline | `vite-plugin-pwa` + Workbox `generateSW`: full app-shell precache (HTML, JS, CSS, every font file, icons), SPA navigation fallback |
| Fonts | Nunito bundled via `@fontsource-variable/nunito` (no Google Fonts / CDN) |
| Conversion | Pure functions in `src/lib/convert.ts` — synchronous, in-memory |
| Files | `File`, `Blob`, `URL.createObjectURL`, Clipboard API (with selection fallback) |

```
src/
  lib/convert.ts          conversion engine (pure)
  lib/presets.ts          quick formats
  lib/files.ts            import, export, clipboard
  lib/storage.ts          preference-only persistence
  pwa/useOfflineStatus.ts service worker registration, cache verification, updates
  components/             Bike art & wordmark, options, status pill, update banner, About
tests/                    Vitest unit + component tests (jsdom)
e2e/                      Playwright offline acceptance tests (real Chromium + real SW)
scripts/generate-icons.mjs  rebuilds favicon + PWA icons from the SVG source
```

### Offline status — what each label means

| Label | Condition |
| --- | --- |
| **Preparing Offline Access** | Service worker is installing, or the precache hasn't been verified yet |
| **Offline Ready** | The precache has been *opened and checked*: `index.html` **and** the JS bundle it references are present |
| **Offline Mode** | No network; running from the cached copy |
| **Update Available** | A new version finished downloading and is waiting for the user's consent |

"Offline Ready" is never shown just because a service worker registered — Shim reads the cache to confirm. If the browser evicts the cache later, Shim notices on the next online visit and re-installs the offline copy automatically. It also requests persistent storage (`navigator.storage.persist()`) to make eviction less likely.

### Safe updates

- `registerType: 'prompt'`: a new version installs in the background but **never activates on its own**.
- Shim checks for updates on load, every hour, and whenever the connection comes back.
- The user sees *"A fresh Shim is ready to ride"* and can choose **Update now** or **Later**. Nothing reloads unasked.
- On **Update now**, any text in the input is handed to the next page load via a tab-scoped, one-shot `sessionStorage` entry that is deleted the instant it is read. This is the only time user text touches storage, and only after explicit consent.
- If an update download fails or is interrupted, the old version keeps working and the check is retried later.

### Privacy guarantees

- No backend, database, auth, analytics or telemetry. No external requests at all.
- User text and imported files exist only in memory (React state). Not in `localStorage`, cookies, URLs or logs.
- Only preferences (theme, formatting options) are saved locally.
- Enforced at the browser level on Vercel by a Content-Security-Policy with `connect-src 'self'`, `form-action 'none'` and no third-party origins, so even a compromised dependency could not send data elsewhere.

---

## Development

Requires Node.js `^20.19` or `>=22.12`.

```bash
npm install
npm run dev          # local dev server (service worker disabled in dev)
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build (service worker enabled)
npm test             # unit + component tests
npm run test:e2e     # offline acceptance tests in Chromium (see below)
npm run test:all     # everything
```

The first time you run the browser tests, install Chromium:

```bash
npx playwright install chromium
```

(Or point to any Chromium with `CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.)

---

## Deploying to Vercel

1. Push this folder to a GitHub / GitLab / Bitbucket repository.
2. In Vercel: **Add New → Project → Import** the repository.
3. Settings (already declared in `vercel.json`, shown here for reference):

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

4. **Deploy.** Vercel serves it over HTTPS, which service workers require.

Or from the command line: `npx vercel` (preview) then `npx vercel --prod`.

`vercel.json` also configures:
- SPA fallback to `index.html` (real files always take precedence)
- `sw.js` → `no-cache` so new releases are detected immediately
- `/assets/*` → immutable 1-year caching (filenames are content-hashed)
- Security headers: CSP, `Referrer-Policy: no-referrer`, `nosniff`, `Permissions-Policy`

No environment variables, Functions, Edge Functions or databases are used.

---

## Testing

### Automated (all passing)

- **71 unit & component tests** (`npm test`): conversion edge cases (CRLF, BOM, unicode, quoted CSV, ragged rows, escaping for SQL/JSON/CSV, round-trips), all presets, sorting & dedupe, 200k-line performance, file decoding, storage, UI flows, the status labels, the consent-based update flow, and a privacy test that spies on `fetch`, XHR, `sendBeacon` and WebSocket.
- **8 browser tests** (`npm run test:e2e`) against the real production build, with the exact `vercel.json` headers applied. "Offline" means the host is **shut down** *and* Chromium network emulation is offline:

| Test | What is verified |
| --- | --- |
| A | First visit: all requests same-origin, precache contains shell + bundles + fonts + icons, manifest valid, no console/CSP errors |
| B | Offline: multi-column conversion, header skip, dedupe, column pick, SQL / JSON / HTML / Pipe presets, sort, case, custom separator, clipboard copy, reverse direction |
| C | Offline reload and deep-link navigation still load and convert |
| D | Offline CSV & TXT import, conversion, and TXT / JSON / CSV downloads (file contents checked) |
| E | Brand-new browser process on the same profile, offline from the start |
| F | Interrupted update check is harmless; new release detected on reconnect; no automatic reload; "Later" keeps working; "Update now" reloads into the new version **with the unsaved text restored**; new version also works offline |
| G | Secret text typed, imported, copied and downloaded → zero network requests, nothing POSTed, nothing cross-origin, nothing persisted |
| a11y | axe-core WCAG 2.1 A/AA: zero violations in light & dark, desktop & mobile |

### Manual check on your live Vercel URL

1. **A** Open the URL. Wait for **Offline Ready** in the header.
2. **B** DevTools → Network → *Offline* (or turn off Wi-Fi). Status shows **Offline Mode**. Paste spreadsheet columns, try presets, copy.
3. **C** Reload while offline. Shim loads.
4. **D** Import a CSV, convert, download — all offline.
5. **E** Quit the browser completely, keep Wi-Fi off, reopen the URL.
6. **F** Deploy a change, type some text in the open tab, reconnect. **Update Available** appears; click *Update now*; your text is still there.
7. **G** DevTools → Network, filter *All*. Type and convert: no requests appear.

Offline access lasts as long as the browser keeps site data. Clearing site data, using a private window, or (on Safari) not visiting for an extended period can remove it; just revisit once while online.

---

## Customising

- Colours: CSS variables at the top of `src/index.css` (light and `.dark`).
- Icons: edit `scripts/generate-icons.mjs` and run `npm run icons`.
- Presets: `src/lib/presets.ts`.

## License

MIT
