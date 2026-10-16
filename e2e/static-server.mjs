// Minimal static server that mirrors vercel.json behaviour (SPA fallback + cache headers).
// Used by the e2e suite so tests can stop the "host" entirely to simulate no connectivity.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { readFileSync } from 'node:fs';

// Apply the exact headers from vercel.json (later rules override earlier ones, like Vercel).
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rules = vercel.headers.map((h) => ({
  re: new RegExp('^' + h.source.split('(.*)').map((part) => part.replace(/[.]/g, '\\.')).join('.*') + '$'),
  headers: h.headers,
}));
function vercelHeaders(path) {
  const out = {};
  for (const r of rules) if (r.re.test(path)) for (const { key, value } of r.headers) out[key] = value;
  return out;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

export function startServer(root, port) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, 'index.html'); // SPA fallback
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...vercelHeaders(path) });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export const stopServer = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
