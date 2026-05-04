import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public');

const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c8ff3d"/>
      <stop offset="55%" stop-color="#ffd35a"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </linearGradient>
    <radialGradient id="bg" cx="0.7" cy="0" r="1">
      <stop offset="0%" stop-color="#1a2540"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(256 256)">
    <circle r="170" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="32"/>
    <circle r="170" fill="none" stroke="url(#g)" stroke-width="32" stroke-linecap="round"
            stroke-dasharray="780 1100" transform="rotate(-90)"/>
    <circle r="92" fill="url(#g)"/>
    <text x="0" y="22" text-anchor="middle" font-family="system-ui,sans-serif"
          font-size="96" font-weight="800" fill="#0b1220">26</text>
  </g>
</svg>`;

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c8ff3d"/>
      <stop offset="55%" stop-color="#ffd35a"/>
      <stop offset="100%" stop-color="#ff6b6b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0b1220"/>
  <g transform="translate(256 256)">
    <circle r="120" fill="none" stroke="url(#g)" stroke-width="22" stroke-linecap="round"
            stroke-dasharray="540 800" transform="rotate(-90)"/>
    <circle r="64" fill="url(#g)"/>
    <text x="0" y="14" text-anchor="middle" font-family="system-ui,sans-serif"
          font-size="60" font-weight="800" fill="#0b1220">26</text>
  </g>
</svg>`;

await mkdir(out, { recursive: true });

const buf = Buffer.from(baseSvg);
const mask = Buffer.from(maskableSvg);

await Promise.all([
  sharp(buf).resize(192, 192).png().toFile(resolve(out, 'pwa-192.png')),
  sharp(buf).resize(512, 512).png().toFile(resolve(out, 'pwa-512.png')),
  sharp(mask).resize(512, 512).png().toFile(resolve(out, 'pwa-512-maskable.png')),
  sharp(buf).resize(180, 180).png().toFile(resolve(out, 'apple-touch-icon.png'))
]);

console.log('icons ok ->', out);
