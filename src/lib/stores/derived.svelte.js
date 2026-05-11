import { appState } from './appState.svelte.js';
import { stickers, totalStickers, totalSpecial, stickerByCode, mcStickerByCode } from '../data/album.js';

// Lookup global cobrindo album oficial + colecao MC.
export function lookupSticker(code) {
  return stickerByCode[code] || mcStickerByCode[code] || null;
}

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
  return appState.packs.reduce((acc, p) => acc + (p.cost || 0) * (p.qty || 1), 0);
}

export function totalPacks() {
  return appState.packs.reduce((acc, p) => acc + (p.qty || 1), 0);
}

export function totalStickersFromPacks() {
  return appState.packs.reduce((acc, p) => acc + (p.count || 0) * (p.qty || 1), 0);
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

// === Compromissos ===

export function commitmentsByType(type) {
  return appState.commitments.filter((c) => c.type === type);
}

export function commitmentsByCode(code) {
  return appState.commitments.filter((c) => c.code === code);
}

export function totalCommittedToGive() {
  return commitmentsByType('give').length;
}

export function totalCommittedToReceive() {
  return commitmentsByType('expect').length;
}

// Quantas repetidas estao "comprometidas pra entregar" no codigo X.
export function pendingGiveForCode(code) {
  return appState.commitments.filter((c) => c.code === code && c.type === 'give').length;
}

// === "Faltam pra fechar" — times mais proximos do completo ===
// Util pra estrategia: foca esforco nos times quase fechados.
export function teamProgressSummary() {
  const byTeam = new Map();
  for (const s of stickers) {
    if (!s.team) continue;
    if (!byTeam.has(s.team)) byTeam.set(s.team, { team: s.team, section: s.section, total: 0, owned: 0 });
    const t = byTeam.get(s.team);
    t.total++;
    if ((appState.collected[s.code] || 0) > 0) t.owned++;
  }
  return [...byTeam.values()]
    .map((t) => ({ ...t, missing: t.total - t.owned, pct: t.total ? (t.owned / t.total) * 100 : 0 }))
    .filter((t) => t.missing > 0)            // ja completos saem da lista
    .sort((a, b) => a.missing - b.missing || b.pct - a.pct);
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
