import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'public');

// Logo "FIGS" sport-tv: F dourado em navy, faixa tricolor lateral
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
      <stop offset="0%"  stop-color="rgba(251,191,36,0.4)"/>
      <stop offset="100%" stop-color="rgba(251,191,36,0)"/>
    </radialGradient>
  </defs>

  <!-- BG -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Faixa tricolor vertical na esquerda (broadcast accent) -->
  <rect x="48" y="120" width="6" height="100" fill="#1d4ed8"/>
  <rect x="48" y="220" width="6" height="100" fill="#dc2626"/>
  <rect x="48" y="320" width="6" height="80"  fill="#16a34a"/>

  <!-- Glow dourado atrás do F -->
  <circle cx="280" cy="270" r="180" fill="url(#glow)"/>

  <!-- Letra F gigante dourada (Bebas-style geometrica) -->
  <g fill="url(#gold)">
    <!-- Haste vertical -->
    <rect x="160" y="120" width="80" height="280"/>
    <!-- Barra superior -->
    <rect x="160" y="120" width="220" height="60"/>
    <!-- Barra do meio -->
    <rect x="160" y="220" width="170" height="50"/>
  </g>

  <!-- Microdetalhe "26" no canto inferior direito (subtle) -->
  <text x="430" y="450" text-anchor="end"
        font-family="'Bebas Neue','Space Grotesk',system-ui,sans-serif"
        font-size="42" font-weight="700" fill="rgba(251,191,36,0.6)" letter-spacing="2">26</text>
</svg>`;

// Maskable: F centralizada com bastante safe zone
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#fde68a"/>
      <stop offset="55%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#050b1f"/>
  <g fill="url(#gold)" transform="translate(0,0)">
    <rect x="200" y="170" width="56" height="180"/>
    <rect x="200" y="170" width="140" height="42"/>
    <rect x="200" y="240" width="108" height="36"/>
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

// iOS App icon (Capacitor) — 1024x1024 sem alpha
const iosIcon = resolve(here, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
if (existsSync(dirname(iosIcon))) {
  await sharp(buf)
    .resize(1024, 1024)
    .flatten({ background: '#050b1f' })
    .png()
    .toFile(iosIcon);
  console.log('ios icon ok ->', iosIcon);
}

// favicon SVG (atualizado)
import { writeFile } from 'node:fs/promises';
await writeFile(resolve(out, 'favicon.svg'), baseSvg, 'utf-8');
console.log('favicon ok');
