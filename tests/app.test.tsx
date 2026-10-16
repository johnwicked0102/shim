import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => vi.fn()) }));

import App from '../src/App';

const SECRET = 'TOP-SECRET-customer-4111';

let blobs: Blob[] = [];
let network: string[] = [];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  blobs = [];
  network = [];
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn().mockResolvedValue('Kiwi\nLime') },
    configurable: true,
  });
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return 'blob:local/1';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  // Record every possible network channel. Shim must never use any of them.
  vi.stubGlobal('fetch', vi.fn((u: unknown) => {
    network.push(`fetch ${String(u)}`);
    return Promise.reject(new Error('blocked'));
  }));
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(function (_m: string, u: string | URL) {
    network.push(`xhr ${String(u)}`);
  });
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn((u: string) => (network.push(`beacon ${u}`), true)), configurable: true });
  vi.stubGlobal('WebSocket', vi.fn((u: string) => network.push(`ws ${u}`)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const input = () => screen.getByTestId('input') as HTMLTextAreaElement;
const output = () => screen.getByTestId('output') as HTMLTextAreaElement;

describe('App', () => {
  it('shows the Shim brand and privacy label', () => {
    render(<App />);
    expect(screen.getAllByRole('img', { name: 'Shim' }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('privacy')).toHaveTextContent('100% Local Processing — Your text never leaves your browser.');
    expect(screen.queryByText(/PedalList/i)).toBeNull();
  });

  it('converts a column into a comma-separated list live', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: 'Apple\nBanana\nCherry\nMango' } });
    await waitFor(() => expect(output().value).toBe('Apple, Banana, Cherry, Mango'));
    expect(screen.getByTestId('summary')).toHaveTextContent('4 items converted');
    expect(screen.getByText('Separator: Comma + Space')).toBeInTheDocument();
  });

  it('converts spreadsheet columns and applies presets', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: 'a\t1\nb\t2' } });
    await waitFor(() => expect(output().value).toBe('a, 1, b, 2'));
    fireEvent.click(screen.getByRole('button', { name: /SQL IN/ }));
    await waitFor(() => expect(output().value).toBe("('a', '1', 'b', '2')"));
    fireEvent.click(screen.getByRole('button', { name: /JSON Array/ }));
    await waitFor(() => expect(JSON.parse(output().value)).toEqual(['a', '1', 'b', '2']));
  });

  it('removes duplicates and sorts via options', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: 'b\na\nb' } });
    fireEvent.click(screen.getByRole('switch', { name: 'Remove duplicates' }));
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'asc' } });
    await waitFor(() => expect(output().value).toBe('a, b'));
    expect(screen.getByTestId('summary')).toHaveTextContent('1 duplicate removed');
  });

  it('copies the result with the Clipboard API', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: 'x\ny' } });
    await waitFor(() => expect(output().value).toBe('x, y'));
    await userEvent.click(screen.getByTestId('copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('x, y');
    await screen.findByText('Copied!');
  });

  it('pastes from the clipboard', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Paste List/ }));
    await waitFor(() => expect(output().value).toBe('Kiwi, Lime'));
  });

  it('imports a local CSV file and downloads TXT / CSV / JSON exports', async () => {
    render(<App />);
    const file = new File(['id,fruit\n1,Apple\n2,"Pear, ripe"\n'], 'fruits.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    await waitFor(() => expect(input().value).toContain('Pear, ripe'));
    fireEvent.change(screen.getByLabelText('Combine cells'), { target: { value: 'pick' } });
    fireEvent.change(screen.getByLabelText('Column number'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('switch', { name: 'First line is a header' }));
    await waitFor(() => expect(output().value).toBe('Apple, Pear, ripe'));

    fireEvent.click(screen.getByTestId('download'));
    expect(await blobs[0].text()).toBe('Apple, Pear, ripe');
    expect(blobs[0].type).toContain('text/plain');

    fireEvent.change(screen.getByLabelText('Download format'), { target: { value: 'json' } });
    fireEvent.click(screen.getByTestId('download'));
    expect(JSON.parse(await blobs[1].text())).toEqual(['Apple', 'Pear, ripe']);

    fireEvent.change(screen.getByLabelText('Download format'), { target: { value: 'csv' } });
    fireEvent.click(screen.getByTestId('download'));
    expect(blobs[2].type).toContain('text/csv');
  });

  it('rejects non-text files politely', async () => {
    render(<App />);
    const file = new File([new Uint8Array([0, 1, 2])], 'photo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('announcer')).toHaveTextContent(/isn't a text file/));
  });

  it('swaps direction: list back to column', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: 'a\nb\nc' } });
    await waitFor(() => expect(output().value).toBe('a, b, c'));
    fireEvent.click(screen.getAllByRole('button', { name: /Swap/ })[0]);
    await waitFor(() => expect(input().value).toBe('a, b, c'));
    await waitFor(() => expect(output().value).toBe('a\nb\nc'));
  });

  it('toggles dark theme and persists only the preference', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Switch to dark theme/ }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('shim:theme')).toBe('dark');
  });

  it('PRIVACY: never stores or transmits user text', async () => {
    render(<App />);
    fireEvent.change(input(), { target: { value: `${SECRET}\nsecond` } });
    await waitFor(() => expect(output().value).toContain(SECRET));
    fireEvent.click(screen.getByRole('button', { name: /JSON Array/ }));
    await userEvent.click(screen.getByTestId('copy'));
    fireEvent.click(screen.getByTestId('download'));
    await act(() => new Promise((r) => setTimeout(r, 50)));

    const stored = [
      ...Object.keys(localStorage).map((k) => localStorage.getItem(k)),
      ...Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)),
      document.cookie,
      location.href,
    ].join('\n');
    expect(stored).not.toContain(SECRET);
    expect(network).toEqual([]);
  });
});
