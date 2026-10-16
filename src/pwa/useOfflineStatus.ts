import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export type OfflineState =
  | 'preparing' // service worker installing / precache incomplete
  | 'ready' // precache verified, app works offline
  | 'offline' // no network, running from cache
  | 'offline-unprepared' // no network and precache NOT verified (rare: went offline mid-install)
  | 'unsupported'; // no service worker support (or dev mode)

export interface OfflineStatus {
  state: OfflineState;
  online: boolean;
  /** True when the precache has been verified to contain the app shell. */
  cached: boolean;
  updateAvailable: boolean;
  updating: boolean;
  updateError: string | null;
  /** Activates the waiting service worker and reloads. Call only after user consent. */
  applyUpdate: (beforeReload?: () => void) => Promise<void>;
  dismissUpdate: () => void;
  checkForUpdate: () => void;
}

const SW_URL = '/sw.js';
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/** Is the app shell present in the Workbox precache? (Revision params are ignored.) */
async function shellIsCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const keys = await caches.keys();
    const precache = keys.find((k) => k.startsWith('workbox-precache'));
    if (!precache) return false;
    const cache = await caches.open(precache);
    const hit = await cache.match('/index.html', { ignoreSearch: true });
    if (!hit) return false;
    // The shell must reference a JS entry that is also cached.
    const html = await hit.clone().text();
    const entry = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    return entry ? Boolean(await cache.match(entry, { ignoreSearch: true })) : true;
  } catch {
    return false;
  }
}

export function useOfflineStatus(): OfflineStatus {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD;
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [cached, setCached] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const repairedRef = useRef(false);

  const verify = useCallback(async () => {
    const ok = await shellIsCached();
    setCached(ok);
    return ok;
  }, []);

  const checkForUpdate = useCallback(() => {
    const reg = regRef.current;
    if (!reg || !navigator.onLine) return;
    // A failed update check (network drop, 5xx) leaves the current version fully working.
    reg.update().catch(() => undefined);
  }, []);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      checkForUpdate();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!supported) return;
    let interval: number | undefined;
    let cancelled = false;

    // Ask the browser not to evict our cache under storage pressure (best effort).
    navigator.storage?.persist?.().catch(() => undefined);

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setUpdateAvailable(true);
      },
      onOfflineReady() {
        void verify();
      },
      onRegisteredSW(_url, reg) {
        if (!reg || cancelled) return;
        regRef.current = reg;
        const track = (sw: ServiceWorker | null) => {
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'activated') void verify();
            // An install that ends as "redundant" without activating was interrupted;
            // the previous version keeps serving and we simply retry later.
            if (sw.state === 'redundant' && !reg.waiting && !reg.active) setUpdateError('Offline setup was interrupted. Retrying when online.');
          });
        };
        track(reg.installing);
        reg.addEventListener('updatefound', () => track(reg.installing));
        void navigator.serviceWorker.ready.then(() => verify());
        interval = window.setInterval(() => checkForUpdate(), UPDATE_INTERVAL_MS);
      },
      onRegisterError() {
        setUpdateError('Offline support could not start in this browser.');
      },
    });

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [supported, verify, checkForUpdate]);

  // Graceful recovery from cache eviction: if a service worker is active but its precache
  // vanished, re-register once so the shell is downloaded and cached again.
  useEffect(() => {
    if (!supported || cached || !online) return;
    const t = window.setTimeout(async () => {
      const reg = regRef.current;
      if (!reg?.active || reg.installing || reg.waiting || repairedRef.current) return;
      if (await verify()) return;
      repairedRef.current = true;
      try {
        await reg.unregister();
        const fresh = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
        regRef.current = fresh;
        fresh.addEventListener('updatefound', () => {
          fresh.installing?.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') void verify();
          });
        });
      } catch {
        /* stay usable online; we'll retry on next load */
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [supported, cached, online, verify]);

  const applyUpdate = useCallback(async (beforeReload?: () => void) => {
    if (!updateSWRef.current) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      beforeReload?.();
      await updateSWRef.current(true);
      // If the controller didn't change (e.g. waiting worker vanished), don't hang.
      window.setTimeout(() => {
        setUpdating(false);
        setUpdateError('The update could not be activated. Your current version still works.');
      }, 10000);
    } catch {
      setUpdating(false);
      setUpdateError('The update could not be activated. Your current version still works.');
    }
  }, []);

  let state: OfflineState;
  if (!supported) state = 'unsupported';
  else if (!online) state = cached ? 'offline' : 'offline-unprepared';
  else state = cached ? 'ready' : 'preparing';

  return {
    state,
    online,
    cached,
    updateAvailable,
    updating,
    updateError,
    applyUpdate,
    dismissUpdate: () => setUpdateAvailable(false),
    checkForUpdate,
  };
}
