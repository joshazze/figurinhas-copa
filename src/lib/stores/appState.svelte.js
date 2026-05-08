// Store reativo (Svelte 5 runes) com persistencia em localStorage.
// Compativel com export/import JSON.

const STORAGE_KEY = 'figurinhas-copa@v1';

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
  settings: {
    stickersPerPack: 7,         // fallback global (origem desconhecida)
    defaultPackPrice: 7.00,     // R$ 7,00 por pacote (oficial)
    currency: 'R$'
  },
  meta: { createdAt: null }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      meta: { ...defaultState.meta, ...(parsed.meta || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const initial = load();
if (!initial.meta.createdAt) initial.meta.createdAt = new Date().toISOString();

export const appState = $state(initial);

// Persistencia automatica
$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {}
  });
});

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
}

export function exportJSON() {
  return JSON.stringify(appState, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  appState.collected = parsed.collected || {};
  appState.packs = parsed.packs || [];
  appState.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
  appState.settings = { ...defaultState.settings, ...(parsed.settings || {}) };
  appState.meta = { ...defaultState.meta, ...(parsed.meta || {}) };
}
