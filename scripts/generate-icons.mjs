import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public');

const baseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#0a1330"/>
      <stop offset="100%" stop-color="#050b1f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#fde68a"/>
      <stop offset="55%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0%"  stop-color="rgba(251,191,36,0.35)"/>
      <stop offset="100%" stop-color="rgba(251,191,36,0)"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Faixa tricolor topo: USA azul / vermelho / México verde -->
  <rect x="0"   y="0" width="180" height="32" fill="#1d4ed8"/>
  <rect x="180" y="0" width="152" height="32" fill="#dc2626"/>
  <rect x="332" y="0" width="180" height="32" fill="#16a34a"/>
  <!-- Glow dourado -->
  <circle cx="256" cy="280" r="220" fill="url(#glow)"/>
  <!-- Número 26 dourado central -->
  <text x="256" y="370" text-anchor="middle"
        font-family="'Bebas Neue','Space Grotesk',system-ui,sans-serif"
        font-size="320" font-weight="900" fill="url(#gold)" letter-spacing="-8">26</text>
  <!-- Slogan -->
  <text x="256" y="440" text-anchor="middle"
        font-family="'Bebas Neue','Space Grotesk',system-ui,sans-serif"
        font-size="42" font-weight="700" fill="#dde3f2" letter-spacing="14">SOMOS 26</text>
</svg>`;

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#fde68a"/>
      <stop offset="55%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#050b1f"/>
  <!-- Faixa tricolor reduzida (segura para safe zone) -->
  <rect x="160" y="160" width="64" height="12" fill="#1d4ed8"/>
  <rect x="224" y="160" width="64" height="12" fill="#dc2626"/>
  <rect x="288" y="160" width="64" height="12" fill="#16a34a"/>
  <!-- Número 26 -->
  <text x="256" y="340" text-anchor="middle"
        font-family="'Bebas Neue','Space Grotesk',system-ui,sans-serif"
        font-size="200" font-weight="900" fill="url(#gold)" letter-spacing="-4">26</text>
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
