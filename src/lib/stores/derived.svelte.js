import { appState } from './appState.svelte.js';
import { stickers, totalStickers, totalSpecial } from '../data/album.js';

// Helpers derivados (puros, recalculam quando state muda)

export function uniqueOwned() {
  let n = 0;
  for (const s of stickers) if ((appState.collected[s.code] || 0) > 0) n++;
  return n;
}

export function totalGlued() {
  // Total de figurinhas coladas (somando duplicatas)
  let n = 0;
  for (const code in appState.collected) n += appState.collected[code] || 0;
  return n;
}

export function duplicates() {
  const out = [];
  for (const s of stickers) {
    const c = appState.collected[s.code] || 0;
    if (c > 1) out.push({ sticker: s, count: c, extras: c - 1 });
  }
  return out;
}

export function totalDuplicates() {
  let n = 0;
  for (const code in appState.collected) {
    const c = appState.collected[code] || 0;
    if (c > 1) n += c - 1;
  }
  return n;
}

export function totalSpent() {
  return appState.packs.reduce((acc, p) => acc + (p.cost || 0), 0);
}

export function totalPacks() {
  return appState.packs.length;
}

export function totalStickersFromPacks() {
  return appState.packs.reduce((acc, p) => acc + (p.count || 0), 0);
}

export function avgPackCost() {
  const n = totalPacks();
  return n ? totalSpent() / n : 0;
}

export function avgStickerCost() {
  const n = totalStickersFromPacks();
  return n ? totalSpent() / n : 0;
}

export function completionPct() {
  return totalStickers ? (uniqueOwned() / totalStickers) * 100 : 0;
}

export function missing() {
  return stickers.filter((s) => !(appState.collected[s.code] > 0));
}

export function totalMissing() {
  return totalStickers - uniqueOwned();
}

export function uniqueSpecialOwned() {
  let n = 0;
  for (const s of stickers) {
    if (s.special && (appState.collected[s.code] || 0) > 0) n++;
  }
  return n;
}

export function totalSpecialStickers() {
  return totalSpecial;
}

// Estimativa de pacotes necessarios pra completar (heuristica simples
// baseada no custo medio por figurinha unica obtida).
export function estimatedRemainingCost() {
  const owned = uniqueOwned();
  if (!owned) return 0;
  const spent = totalSpent();
  // R$ por figurinha unica conseguida ate aqui
  const costPerUnique = spent / owned;
  return costPerUnique * totalMissing();
}
