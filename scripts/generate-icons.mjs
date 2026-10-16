// Generates Shim's favicon + PWA icons from one original SVG source.
// Run with: npm run icons   (outputs are committed in /public, so builds don't need this)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const MINT = '#A8DCCB';
const INK = '#2F3E38';
const PEACH = '#F2B5A0';

const bike = (stroke) => `
  <g fill="none" stroke="${stroke}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="16" cy="42" r="10.5"/><circle cx="48" cy="42" r="10.5"/>
    <path d="M16 42 L30 42 L24 25 Z"/><path d="M24 25 H42 L30 42"/><path d="M42 25 L48 42"/>
    <path d="M42 25 L40 18.5 H45.5"/><path d="M20 21.5 H28" stroke-width="3.8"/><path d="M24 21.5 V25"/>
  </g>
  <g stroke="${stroke}" stroke-width="1.1" stroke-linecap="round" opacity="0.55">
    <path d="M16 34V50M8 42H24M48 34V50M40 42H56"/>
  </g>
  <circle cx="16" cy="42" r="2.2" fill="${stroke}"/><circle cx="48" cy="42" r="2.2" fill="${stroke}"/>
  <circle cx="30" cy="42" r="2.6" fill="${PEACH}" stroke="${stroke}" stroke-width="1.2"/>`;

/** padding = fraction of the canvas left around the bike (maskable icons need ~20% safe zone). */
const icon = ({ radius, padding }) => {
  const s = 64 * (1 - padding * 2);
  const o = 64 * padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${radius}" fill="${MINT}"/>
  <g transform="translate(${o} ${o - 2}) scale(${s / 64})">${bike(INK)}</g>
</svg>`;
};

const favicon = icon({ radius: 14, padding: 0.04 });
writeFileSync('public/favicon.svg', favicon);

const render = (svg, size, file) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(`public/${file}`, png);
  console.log('wrote', file);
};

render(favicon, 32, 'favicon-32.png');
render(icon({ radius: 0, padding: 0.1 }), 180, 'apple-touch-icon.png');
render(icon({ radius: 14, padding: 0.06 }), 192, 'pwa-192.png');
render(icon({ radius: 14, padding: 0.06 }), 512, 'pwa-512.png');
render(icon({ radius: 0, padding: 0.2 }), 512, 'pwa-maskable-512.png');
