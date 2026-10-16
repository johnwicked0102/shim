import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { statusLabel } from '../src/components/StatusPill';

/**
 * Exercises the update + offline-status flow with a fake service worker,
 * because jsdom has none. Real browser behaviour is covered by e2e/offline.spec.ts.
 */

type Hooks = { onNeedRefresh?: () => void; onOfflineReady?: () => void; onRegisteredSW?: (u: string, r: unknown) => void };
const hooks: Hooks = {};
const updateSW = vi.fn(async () => undefined);

vi.mock('virtual:pwa-register', () => ({
  registerSW: (h: Hooks) => {
    Object.assign(hooks, h);
    return updateSW;
  },
}));

function installFakeCaches(withShell: boolean) {
  const store = new Map<string, string>();
  if (withShell) {
    store.set('/index.html', '<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    store.set('/assets/index-abc.js', 'js');
  }
  const cache = {
    match: async (url: string) => (store.has(url) ? new Response(store.get(url)) : undefined),
  };
  vi.stubGlobal('caches', {
    keys: async () => (withShell ? ['workbox-precache-v2-https://shim.test/'] : []),
    open: async () => cache,
  });
}

function installFakeServiceWorker() {
  const reg = {
    installing: null,
    waiting: null,
    active: { state: 'activated' },
    update: vi.fn(async () => undefined),
    addEventListener: vi.fn(),
    unregister: vi.fn(async () => true),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(reg), register: vi.fn(async () => reg), controller: {} },
    configurable: true,
  });
  return reg;
}

beforeEach(() => {
  vi.stubEnv('PROD', true);
  sessionStorage.clear();
  updateSW.mockClear();
  for (const k of Object.keys(hooks)) delete (hooks as Record<string, unknown>)[k];
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function renderApp() {
  const { default: App } = await import('../src/App');
  return render(<App />);
}

describe('offline status indicator', () => {
  it('maps every state to the required wording', () => {
    expect(statusLabel({ state: 'ready', updateAvailable: false })).toBe('Offline Ready');
    expect(statusLabel({ state: 'offline', updateAvailable: false })).toBe('Offline Mode');
    expect(statusLabel({ state: 'preparing', updateAvailable: false })).toBe('Preparing Offline Access');
    expect(statusLabel({ state: 'ready', updateAvailable: true })).toBe('Update Available');
  });

  it('shows "Preparing" until the precache is verified, then "Offline Ready"', async () => {
    installFakeCaches(false);
    const reg = installFakeServiceWorker();
    await renderApp();
    act(() => hooks.onRegisteredSW?.('/sw.js', reg));
    expect(screen.getByTestId('status')).toHaveTextContent('Preparing Offline Access');

    installFakeCaches(true);
    act(() => hooks.onOfflineReady?.());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Offline Ready'));
  });

  it('does not claim readiness when the JS bundle is missing from cache', async () => {
    const store = new Map([['/index.html', '<script type="module" crossorigin src="/assets/index-zzz.js"></script>']]);
    vi.stubGlobal('caches', {
      keys: async () => ['workbox-precache-v2-x'],
      open: async () => ({ match: async (u: string) => (store.has(u) ? new Response(store.get(u)) : undefined) }),
    });
    const reg = installFakeServiceWorker();
    await renderApp();
    act(() => hooks.onRegisteredSW?.('/sw.js', reg));
    act(() => hooks.onOfflineReady?.());
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.getByTestId('status')).toHaveTextContent('Preparing Offline Access');
  });

  it('switches to "Offline Mode" when the network drops', async () => {
    installFakeCaches(true);
    const reg = installFakeServiceWorker();
    await renderApp();
    act(() => hooks.onRegisteredSW?.('/sw.js', reg));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('Offline Ready'));
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('status')).toHaveTextContent('Offline Mode');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('status')).toHaveTextContent('Offline Ready');
    // Coming back online triggers an update check.
    expect(reg.update).toHaveBeenCalled();
  });
});

describe('safe updates', () => {
  it('asks before updating and never reloads on its own', async () => {
    installFakeCaches(true);
    const reg = installFakeServiceWorker();
    await renderApp();
    act(() => hooks.onRegisteredSW?.('/sw.js', reg));
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'unsaved\nwork' } });

    act(() => hooks.onNeedRefresh?.());
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Your current text will be carried over');
    expect(screen.getByTestId('status')).toHaveTextContent('Update Available');
    expect(updateSW).not.toHaveBeenCalled();

    // "Later" keeps working on the current version.
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(updateSW).not.toHaveBeenCalled();

    // Re-open from the pill and accept.
    fireEvent.click(screen.getByTestId('status'));
    fireEvent.click(screen.getByRole('button', { name: /Update now/ }));
    await waitFor(() => expect(updateSW).toHaveBeenCalledWith(true));
    // The unsaved text is handed to the next page load (tab-scoped, one-shot).
    expect(sessionStorage.getItem('shim:update-handoff')).toBe('unsaved\nwork');
  });

  it('restores handed-off text after the update reload and deletes it', async () => {
    installFakeCaches(true);
    installFakeServiceWorker();
    sessionStorage.setItem('shim:update-handoff', 'restored\ntext');
    await renderApp();
    expect((screen.getByTestId('input') as HTMLTextAreaElement).value).toBe('restored\ntext');
    expect(sessionStorage.getItem('shim:update-handoff')).toBeNull();
  });

  it('keeps the app usable if activating the update fails', async () => {
    installFakeCaches(true);
    const reg = installFakeServiceWorker();
    updateSW.mockRejectedValueOnce(new Error('network'));
    await renderApp();
    act(() => hooks.onRegisteredSW?.('/sw.js', reg));
    act(() => hooks.onNeedRefresh?.());
    fireEvent.click(await screen.findByRole('button', { name: /Update now/ }));
    expect(await screen.findByText(/current version still works/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('input'), { target: { value: 'still\nworks' } });
    await waitFor(() => expect((screen.getByTestId('output') as HTMLTextAreaElement).value).toBe('still, works'));
  });
});
