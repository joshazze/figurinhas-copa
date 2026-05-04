// Store reativo (Svelte 5 runes) com persistencia em localStorage.
// Compativel com export/import JSON.

const STORAGE_KEY = 'figurinhas-copa@v1';

const defaultState = {
  collected: {},          // { [code]: count }
  packs: [],              // [{ id, date, cost, count }]
  settings: {
    stickersPerPack: 7,         // padrao oficial Panini Copa 2026
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

// === Acoes ===

export function addSticker(code, qty = 1) {
  const cur = appState.collected[code] || 0;
  appState.collected = { ...appState.collected, [code]: Math.max(0, cur + qty) };
}

export function setStickerCount(code, n) {
  const v = Math.max(0, Math.floor(n || 0));
  if (v === 0) {
    const next = { ...appState.collected };
    delete next[code];
    appState.collected = next;
  } else {
    appState.collected = { ...appState.collected, [code]: v };
  }
}

export function toggleSticker(code) {
  const cur = appState.collected[code] || 0;
  setStickerCount(code, cur > 0 ? 0 : 1);
}

export function addPack({ cost, count, date }) {
  const pack = {
    id: crypto.randomUUID(),
    date: date || new Date().toISOString(),
    cost: Number(cost) || 0,
    count: Math.floor(Number(count) || appState.settings.stickersPerPack)
  };
  appState.packs = [pack, ...appState.packs];
  return pack;
}

export function removePack(id) {
  appState.packs = appState.packs.filter((p) => p.id !== id);
}

export function updateSettings(patch) {
  appState.settings = { ...appState.settings, ...patch };
}

export function resetAll() {
  appState.collected = {};
  appState.packs = [];
}

export function exportJSON() {
  return JSON.stringify(appState, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  appState.collected = parsed.collected || {};
  appState.packs = parsed.packs || [];
  appState.settings = { ...defaultState.settings, ...(parsed.settings || {}) };
  appState.meta = { ...defaultState.meta, ...(parsed.meta || {}) };
}
