/**
 * Shim offline acceptance tests (master spec §7, Tests A–G).
 *
 * Runs the real production build in Chromium with a real service worker.
 * "Offline" is simulated two ways at once: the static host is shut down
 * completely AND Chromium's network emulation is set to offline.
 */
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import { startServer, stopServer } from './static-server.mjs';

const PORT = 4321;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ROOT = resolve(process.cwd());
const BUILDS = join(ROOT, 'e2e', '.builds');
const V1 = join(BUILDS, 'v1');
const V2 = join(BUILDS, 'v2');
const SECRET = 'SECRET-payroll-row-98765';

let server: Server | null = null;
let profile: string;

async function serve(dir: string) {
  if (server) await stopServer(server);
  server = await startServer(dir, PORT);
}
async function goOffline(ctx: BrowserContext) {
  if (server) await stopServer(server);
  server = null;
  await ctx.setOffline(true);
}
async function launch(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profile, {
    headless: true,
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: process.env.CHROMIUM_PATH ? ['--no-sandbox', '--no-zygote'] : [],
  });
}
async function waitReady(page: Page) {
  await expect(page.getByTestId('status')).toHaveText(/Offline Ready/, { timeout: 30_000 });
}
const out = (page: Page) => page.getByTestId('output');

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  rmSync(BUILDS, { recursive: true, force: true });
  execSync(`npx vite build --outDir ${V1} --emptyOutDir`, { cwd: ROOT, stdio: 'pipe' });
  execSync(`npx vite build --outDir ${V2} --emptyOutDir`, { cwd: ROOT, stdio: 'pipe', env: { ...process.env, SHIM_VERSION: '1.0.1-e2e' } });
  profile = mkdtempSync(join(tmpdir(), 'shim-profile-'));
});
test.afterAll(async () => {
  if (server) await stopServer(server);
  rmSync(profile, { recursive: true, force: true });
});

test('A — online first visit prepares offline assets', async () => {
  await serve(V1);
  const ctx = await launch();
  const requests: string[] = [];
  ctx.on('request', (r) => requests.push(r.url()));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(ORIGIN + '/');
  await expect(page).toHaveTitle(/Shim/);
  await expect(page.getByRole('img', { name: 'Shim' }).first()).toBeVisible();
  await waitReady(page);

  // Every request went to our own origin — no CDNs, fonts or analytics.
  expect(requests.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith('blob:') && !u.startsWith('data:'))).toEqual([]);

  // The precache really holds the shell, every bundle and the fonts.
  const cached: string[] = await page.evaluate(async () => {
    const name = (await caches.keys()).find((k: string) => k.startsWith('workbox-precache'))!;
    return (await (await caches.open(name)).keys()).map((r: Request) => new URL(r.url).pathname);
  });
  expect(cached).toContain('/index.html');
  expect(cached.some((p) => /\/assets\/index-.*\.js$/.test(p))).toBe(true);
  expect(cached.some((p) => /\/assets\/index-.*\.css$/.test(p))).toBe(true);
  expect(cached.filter((p) => p.endsWith('.woff2')).length).toBeGreaterThan(0);
  expect(cached).toContain('/favicon.svg');
  expect(cached).toContain('/manifest.webmanifest');

  // Manifest is valid and branded.
  const manifest = (await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json())) as { name: string; short_name: string; icons: { purpose: string }[] };
  expect(manifest.name).toContain('Shim');
  expect(manifest.short_name).toBe('Shim');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  // No CSP violations or runtime errors under the production security headers.
  expect(errors).toEqual([]);
  await ctx.close();
});

test('B — offline conversion with every formatting control', async () => {
  await serve(V1);
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/');
  await waitReady(page);
  await goOffline(ctx);
  await expect(page.getByTestId('status')).toHaveText(/Offline Mode/);

  // Multiple spreadsheet columns → comma-separated text.
  await page.getByTestId('input').fill('Fruit\tColour\nApple\tRed\nBanana\tYellow\nApple\tRed');
  await expect(out(page)).toHaveValue('Fruit, Colour, Apple, Red, Banana, Yellow, Apple, Red');

  await page.getByRole('switch', { name: 'First line is a header' }).check({ force: true });
  await page.getByRole('switch', { name: 'Remove duplicates' }).check({ force: true });
  await expect(out(page)).toHaveValue('Apple, Red, Banana, Yellow');

  await page.getByLabel('Combine cells').selectOption('pick');
  await page.getByLabel('Column number').fill('1');
  await expect(out(page)).toHaveValue('Apple, Banana');

  await page.getByRole('button', { name: /SQL IN/ }).click();
  await expect(out(page)).toHaveValue("('Apple', 'Banana')");
  await page.getByRole('button', { name: /JSON Array/ }).click();
  await expect(out(page)).toHaveValue('["Apple", "Banana"]');
  await page.getByRole('button', { name: /HTML List/ }).click();
  await expect(out(page)).toHaveValue('<ul>\n  <li>Apple</li>\n  <li>Banana</li>\n</ul>');
  await page.getByRole('button', { name: /^Pipe/ }).click();
  await page.getByLabel('Order', { exact: true }).selectOption('desc');
  await page.getByLabel('Letter case', { exact: true }).selectOption('upper');
  await expect(out(page)).toHaveValue('BANANA | APPLE');
  await page.getByLabel('Separator', { exact: true }).selectOption('__custom');
  await page.getByLabel('Custom separator').fill(' ~ ');
  await expect(out(page)).toHaveValue('BANANA ~ APPLE');

  // Clipboard copy works offline.
  await page.getByTestId('copy').click();
  await expect(page.getByTestId('copy')).toHaveText(/Copied!/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('BANANA ~ APPLE');

  // Reverse direction offline.
  await page.getByRole('button', { name: 'Reset options' }).click();
  await page.getByTestId('input').fill('a, b, "c, d"');
  await page.getByRole('button', { name: /List → Column/ }).click();
  await expect(out(page)).toHaveValue('a\nb\nc, d');
  await ctx.close();
});

test('C — offline page reload (and deep links) still load and work', async () => {
  const ctx = await launch();
  await ctx.setOffline(true); // host is already down from Test B
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/');
  await expect(page.getByRole('img', { name: 'Shim' }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('status')).toHaveText(/Offline Mode/);
  await page.getByRole('button', { name: 'Reset options' }).click();
  await page.getByTestId('input').fill('one\ntwo\nthree');
  await expect(out(page)).toHaveValue('one, two, three');

  await page.goto(ORIGIN + '/some/deep/link?x=1');
  await page.getByTestId('input').fill('x\ny');
  await expect(out(page)).toHaveValue('x, y');
  await ctx.close();
});

test('D — offline import of TXT/CSV and local download', async () => {
  const ctx = await launch();
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/');
  await page.getByRole('button', { name: 'Reset options' }).click();

  await page.getByTestId('file-input').setInputFiles({
    name: 'customers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,name,city\n1,"Smith, Ann",Leeds\n2,Bo,Oslo\n'),
  });
  await expect(page.getByTestId('input')).toHaveValue(/Smith, Ann/);
  await page.getByRole('switch', { name: 'First line is a header' }).check({ force: true });
  await page.getByLabel('Combine cells').selectOption('pick');
  await page.getByLabel('Column number').fill('2');
  await expect(out(page)).toHaveValue('Smith, Ann, Bo');

  for (const [format, check] of [
    ['txt', (s: string) => expect(s).toBe('Smith, Ann, Bo')],
    ['json', (s: string) => expect(JSON.parse(s)).toEqual(['Smith, Ann', 'Bo'])],
    ['csv', (s: string) => expect(s).toBe('Smith, Ann, Bo')],
  ] as const) {
    await page.getByLabel('Download format').selectOption(format);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`^shim-\\d{8}-\\d{4}\\.${format}$`));
    check(readFileSync((await dl.path())!, 'utf8'));
  }

  await page.getByTestId('file-input').setInputFiles({ name: 'list.txt', mimeType: 'text/plain', buffer: Buffer.from('alpha\nbeta\n') });
  await page.getByRole('button', { name: 'Reset options' }).click();
  await expect(out(page)).toHaveValue('alpha, beta');
  await ctx.close();
});

test('E — browser restart with internet disabled', async () => {
  // Fresh browser process on the same profile; host still down.
  const ctx = await launch();
  await ctx.setOffline(true);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(ORIGIN + '/');
  await expect(page.getByTestId('status')).toHaveText(/Offline Mode/);
  await page.getByTestId('input').fill('restart\nworks');
  await expect(out(page)).toHaveValue(/restart.*works/);
  await ctx.close();
});

test('F — version update keeps unsaved text and only reloads on consent', async () => {
  await serve(V1);
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/');
  await waitReady(page);
  await expect(page.locator('footer')).toContainText('v1.0.0');
  await page.getByRole('button', { name: 'Reset options' }).click();
  await page.getByTestId('input').fill('unsaved\nwork in progress');
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));

  // Interrupted update: host disappears while an update check runs — app keeps working.
  await stopServer(server!);
  server = null;
  await ctx.setOffline(true);
  await ctx.setOffline(false); // fires "online" → update check against a dead host
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('output')).toHaveValue('unsaved, work in progress');

  // New release is deployed; reconnecting detects it.
  await serve(V2);
  await ctx.setOffline(true);
  await ctx.setOffline(false);
  await expect(page.getByTestId('status')).toHaveText(/Update Available/, { timeout: 30_000 });
  await expect(page.getByRole('alertdialog')).toContainText('Your current text will be carried over');

  // Nothing reloaded behind the user's back.
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.getByRole('button', { name: 'Later' }).click();
  await page.getByTestId('input').fill('unsaved\nwork in progress\nmore');
  await expect(out(page)).toHaveValue('unsaved, work in progress, more');

  // User approves → reload into v2 with their text intact.
  await page.getByTestId('status').click();
  await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), page.getByRole('button', { name: /Update now/ }).click()]);
  await expect(page.locator('footer')).toContainText('v1.0.1-e2e', { timeout: 15_000 });
  await expect(page.getByTestId('input')).toHaveValue('unsaved\nwork in progress\nmore');
  expect(await page.evaluate(() => sessionStorage.getItem('shim:update-handoff'))).toBeNull();
  await waitReady(page);

  // v2 also works offline.
  await goOffline(ctx);
  await page.reload();
  await expect(page.locator('footer')).toContainText('v1.0.1-e2e');
  await expect(page.getByTestId('status')).toHaveText(/Offline Mode/);
  await ctx.close();
});

test('G — privacy: user text is never transmitted or stored', async () => {
  await serve(V2);
  const ctx = await launch();
  const page = await ctx.newPage();
  const seen: { url: string; method: string; body: string | null }[] = [];
  ctx.on('request', (r) => seen.push({ url: r.url(), method: r.method(), body: r.postData() }));
  await page.goto(ORIGIN + '/');
  await waitReady(page);
  const before = seen.length;

  await page.getByTestId('file-input').setInputFiles({ name: 'secret.txt', mimeType: 'text/plain', buffer: Buffer.from(`${SECRET}\nrow2`) });
  await page.getByTestId('input').fill(`${SECRET}\nrow2\nrow3`);
  await page.getByRole('button', { name: /JSON Array/ }).click();
  await page.getByRole('switch', { name: 'Remove duplicates' }).check({ force: true });
  await page.getByTestId('copy').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download').click()]);
  expect(readFileSync((await dl.path())!, 'utf8')).toContain(SECRET);
  await page.waitForTimeout(800);

  // Zero network requests of any kind while handling the text.
  expect(seen.slice(before).filter((r) => !r.url.startsWith('blob:'))).toEqual([]);
  // Nothing ever left the origin, nothing was POSTed, nothing carried the secret.
  for (const r of seen) {
    expect(r.url.startsWith(ORIGIN) || r.url.startsWith('blob:')).toBe(true);
    expect(r.method).toBe('GET');
    expect(r.url).not.toContain(SECRET);
    expect(r.body ?? '').not.toContain(SECRET);
  }
  // And it isn't persisted anywhere.
  const stored = await page.evaluate(() =>
    JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie, u: location.href }),
  );
  expect(stored).not.toContain(SECRET);
  await ctx.close();
});
