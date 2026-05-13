// Store reativo (Svelte 5 runes). Server e source-of-truth — nao persiste em
// localStorage. Estado inicial e vazio; sync.pullOnBoot() carrega do servidor
// e cada mutation dispara push imediato.

// Quantidade de figurinhas por origem do pacote (oficial Panini Copa 2026).
//   - mc:    pacote McDonald's (5 figurinhas)
//   - banca: pacote regular de banca (7 figurinhas)
export const STICKERS_BY_SOURCE = { mc: 5, banca: 7 };
export const PACK_SOURCES = ['mc', 'banca'];

// Limite de eventos no log de atividade (FIFO).
const LOG_MAX = 500;

const defaultState = {
  collected: {},          // { [code]: count }
  packs: [],              // [{ id, date, cost, count, qty, source }]
  logs: [],               // [{ id, ts, type, ... }] — atividade recente
  commitments: [],        // [{ id, type, code, person, date }] — promessas/esperas
  settings: {
    stickersPerPack: 7,         // fallback global (origem desconhecida)
    defaultPackPrice: 7.00,     // R$ 7,00 por pacote (oficial)
    currency: 'R$'
  },
  meta: { createdAt: null }
};

export const appState = $state(structuredClone(defaultState));

// === Logs ===

function pushLog(entry) {
  const log = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...entry
  };
  const next = [log, ...appState.logs];
  if (next.length > LOG_MAX) next.length = LOG_MAX;
  appState.logs = next;
}

export function clearLogs() {
  appState.logs = [];
}

// === Acoes ===

export function addSticker(code, qty = 1) {
  const cur = appState.collected[code] || 0;
  const next = Math.max(0, cur + qty);
  if (next === cur) return;
  appState.collected = { ...appState.collected, [code]: next };
  pushLog({ type: 'sticker', code, prev: cur, next });
}

export function setStickerCount(code, n) {
  const cur = appState.collected[code] || 0;
  const v = Math.max(0, Math.floor(n || 0));
  if (v === cur) return;
  if (v === 0) {
    const nextMap = { ...appState.collected };
    delete nextMap[code];
    appState.collected = nextMap;
  } else {
    appState.collected = { ...appState.collected, [code]: v };
  }
  pushLog({ type: 'sticker', code, prev: cur, next: v });
}

export function toggleSticker(code) {
  const cur = appState.collected[code] || 0;
  setStickerCount(code, cur > 0 ? 0 : 1);
}

export function defaultStickersForSource(source) {
  return STICKERS_BY_SOURCE[source] ?? appState.settings.stickersPerPack;
}

export function addPack({ cost, count, date, qty, source }) {
  const validSource = PACK_SOURCES.includes(source) ? source : 'mc';
  const fallback = defaultStickersForSource(validSource);
  const pack = {
    id: crypto.randomUUID(),
    date: date || new Date().toISOString(),
    cost: Number(cost) || 0,
    count: Math.floor(Number(count) || fallback),
    qty: Math.max(1, Math.floor(Number(qty) || 1)),
    source: validSource
  };
  appState.packs = [pack, ...appState.packs];
  pushLog({ type: 'pack_added', pack });
  return pack;
}

export function removePack(id) {
  const pack = appState.packs.find((p) => p.id === id);
  appState.packs = appState.packs.filter((p) => p.id !== id);
  if (pack) pushLog({ type: 'pack_removed', pack });
}

export function updateSettings(patch) {
  appState.settings = { ...appState.settings, ...patch };
}

export function resetAll() {
  appState.collected = {};
  appState.packs = [];
  appState.logs = [];
  appState.commitments = [];
}

// Reset local state to defaults (used on logout to prevent the next user from
// seeing leftover data before pull-on-boot finishes).
export function clearLocalState() {
  const empty = structuredClone(defaultState);
  appState.collected = empty.collected;
  appState.packs = empty.packs;
  appState.logs = empty.logs;
  appState.commitments = empty.commitments;
  appState.settings = empty.settings;
  appState.meta = empty.meta;
}

// === Compromissos (prometidas/esperadas) ===
// type:
//   'give'   — vou entregar pra alguem (uma das minhas repetidas)
//   'expect' — alguem prometeu me dar (entra como "esperada")
export const COMMITMENT_TYPES = ['give', 'expect'];

export function addCommitment({ type, code, person }) {
  const validType = COMMITMENT_TYPES.includes(type) ? type : 'give';
  const entry = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    type: validType,
    code,
    person: (person || '').trim() || '—'
  };
  appState.commitments = [entry, ...appState.commitments];
  pushLog({ type: 'commitment_added', commitment: entry });
  return entry;
}

export function removeCommitment(id) {
  const entry = appState.commitments.find((c) => c.id === id);
  appState.commitments = appState.commitments.filter((c) => c.id !== id);
  if (entry) pushLog({ type: 'commitment_removed', commitment: entry });
}

// Marcar entregue: remove o compromisso 'give' e decrementa repetida (1 unidade saiu).
export function fulfillGive(id) {
  const entry = appState.commitments.find((c) => c.id === id && c.type === 'give');
  if (!entry) return;
  appState.commitments = appState.commitments.filter((c) => c.id !== id);
  addSticker(entry.code, -1);
  pushLog({ type: 'commitment_fulfilled', commitment: entry });
}

// Marcar recebida: remove a 'expect' e incrementa a colecao (figurinha colada).
export function fulfillExpect(id) {
  const entry = appState.commitments.find((c) => c.id === id && c.type === 'expect');
  if (!entry) return;
  appState.commitments = appState.commitments.filter((c) => c.id !== id);
  addSticker(entry.code, 1);
  pushLog({ type: 'commitment_fulfilled', commitment: entry });
}

// Pessoas vistas em compromissos passados (auto-completar).
export function knownPeople() {
  const set = new Set();
  for (const c of appState.commitments) if (c.person && c.person !== '—') set.add(c.person);
  for (const l of appState.logs) {
    if (l.commitment?.person && l.commitment.person !== '—') set.add(l.commitment.person);
  }
  return [...set].sort();
}

export function exportJSON() {
  return JSON.stringify(appState, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  appState.collected = parsed.collected || {};
  appState.packs = parsed.packs || [];
  appState.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
  appState.commitments = Array.isArray(parsed.commitments) ? parsed.commitments : [];
  appState.settings = { ...defaultState.settings, ...(parsed.settings || {}) };
  appState.meta = { ...defaultState.meta, ...(parsed.meta || {}) };
}
