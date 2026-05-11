// Fuzzy match de codigo de figurinha contra o album conhecido.
// OCR pode errar ("BR4 17", "8RA17", "FWC 4"), mas como o set valido e fechado
// e pequeno (~1028 codigos), Levenshtein <=2 corrige boa parte.

import { stickers, mcStickers } from '../data/album.js';

const allStickers = [...stickers, ...mcStickers];

// Mapa de chaves normalizadas -> sticker. Inclui codigo bruto, codigo sem hifen
// e label (no caso das MC, "BRA 13" -> "BRA13").
const indexMap = new Map();
for (const s of allStickers) {
  const keys = new Set();
  keys.add(s.code);
  keys.add(s.code.replace(/[-\s]/g, ''));
  if (s.label) keys.add(s.label.replace(/\s+/g, ''));
  for (const k of keys) indexMap.set(k.toUpperCase(), s);
}

function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[\s\-_\.]/g, '')
    .replace(/[OQ]/g, '0')       // O/0 confusion comum no OCR
    .replace(/[IL]/g, '1');       // I/L/1 confusion
}

// Versao alternativa sem substituicao numerica (algumas confusoes sao "8" como "B").
function normalizeLite(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_\.]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return Infinity;
  if (la === 0) return lb;
  if (lb === 0) return la;
  let prev = new Array(lb + 1);
  let cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[lb];
}

// Tenta casar um token com o album. Retorna { sticker, dist } ou null.
export function matchToken(token, maxDist = 2) {
  if (!token) return null;
  // 1) match exato (normalize lite)
  const lite = normalizeLite(token);
  if (indexMap.has(lite)) return { sticker: indexMap.get(lite), dist: 0 };
  // 2) match exato (normalize com substituicoes)
  const sub = normalize(token);
  if (indexMap.has(sub)) return { sticker: indexMap.get(sub), dist: 0 };
  // 3) fuzzy: escolhe o menor levenshtein, prefere lite
  let best = null;
  for (const [key, sticker] of indexMap) {
    if (Math.abs(key.length - lite.length) > maxDist) continue;
    const d = Math.min(levenshtein(lite, key), levenshtein(sub, key));
    if (d <= maxDist && (best === null || d < best.dist)) {
      best = { sticker, dist: d };
      if (d === 0) break;
    }
  }
  return best;
}

// Quebra texto do OCR em candidatos plausiveis. Regex generoso, com normalizacao.
export function extractCandidates(text) {
  if (!text) return [];
  const found = new Set();
  // varre por janelas tokenizadas (separa por espaços/quebras), depois tenta
  // colar dois tokens vizinhos pra capturar "BRA 17" (separados).
  const raw = text.replace(/[\n\r\t]+/g, ' ').split(/\s+/).filter(Boolean);
  const push = (v) => { if (v) found.add(v); };
  for (let i = 0; i < raw.length; i++) {
    push(raw[i]);
    if (i + 1 < raw.length) push(raw[i] + raw[i + 1]);
  }
  // tambem captura padroes embutidos (sem espaco) como BRA17 em strings maiores
  const inline = text.match(/[A-Za-z]{2,4}-?\s?\d{1,2}/g) || [];
  for (const m of inline) push(m);
  // MC sem numero
  const mc = text.match(/MC\s*-?\s*[A-Za-z]{2,4}/g) || [];
  for (const m of mc) push(m);
  // CAPA
  if (/\bCAPA\b/i.test(text)) push('CAPA');
  return [...found];
}

export function matchAll(text, maxDist = 2) {
  const candidates = extractCandidates(text);
  const out = [];
  const seenCodes = new Set();
  for (const t of candidates) {
    const hit = matchToken(t, maxDist);
    if (hit && !seenCodes.has(hit.sticker.code)) {
      seenCodes.add(hit.sticker.code);
      out.push({ rawToken: t.trim(), sticker: hit.sticker, dist: hit.dist });
    }
  }
  return out;
}
