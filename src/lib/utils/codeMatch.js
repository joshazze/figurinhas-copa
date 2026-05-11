// Casamento ESTRITO de codigo de figurinha contra o album oficial.
//
// Por que estrito? O verso da figurinha Panini e cheio de texto (creditos,
// patrocinio, idiomas multiplos). OCR liberal gera centenas de falso-positivos.
// Aqui:
//   - so aceita prefixo que existe no album (codigo de time real, FWC, MC, CAPA)
//   - so aceita numero dentro do intervalo valido (1-20 pra times, 1-19 pra FWC)
//   - tolera confusoes letra<->digito comuns do OCR em posicao de digito
//   - conta "votos" (codigo aparecendo varias vezes na foto soma confianca)
//   - corte de emergencia: se mais de 40 candidatos sairem, exige >=2 votos

import { stickers, mcStickers } from '../data/album.js';
import { teams } from '../data/teams.js';

const TEAM_CODES = new Set(teams.map((t) => t.code));
const MAX_FWC = 19;
const TEAM_MAX_NUM = 20;       // 1=escudo, 2=foto, 3-20=jogadores

const ALL = new Map();
for (const s of [...stickers, ...mcStickers]) ALL.set(s.code, s);

// Confusoes comuns letra<->digito em fontes ocr
const DIGIT_FIX = { O: '0', I: '1', L: '1', S: '5', B: '8', G: '6', Z: '2' };

function fixDigits(s) {
  return s.split('').map((c) => DIGIT_FIX[c] ?? c).join('');
}

function addVote(map, code) {
  map.set(code, (map.get(code) || 0) + 1);
}

// Extrai candidatos validos do texto bruto.
// Retorna [{ code, votes }] ordenado por votos desc.
export function extractCandidates(text) {
  if (!text) return [];
  const found = new Map();
  // Sanitiza: remove caracteres exoticos, mantem letras/digitos/espaco/hifen
  const upper = String(text).toUpperCase().replace(/[^A-Z0-9 \-\n\r\t]/g, ' ');

  // Pattern 1: [prefixo] + sep opcional + [numero] em borda de palavra
  // Aceita digitos OU letras confundiveis (O/I/L/S/B/G/Z) na posicao do numero.
  const codeRegex = /\b([A-Z]{2,5})[\s\-]?([0-9OILSGBZ]{1,2})\b/g;
  let m;
  while ((m = codeRegex.exec(upper)) !== null) {
    const prefix = m[1];
    const rawDigits = m[2];
    // se o "numero" e so letras, exige que pelo menos uma seja realmente digito
    // pra evitar coisas como "BRA OB" (oh-bee) virarem "BRA08"
    if (!/[0-9]/.test(rawDigits)) continue;
    const digits = fixDigits(rawDigits);
    if (!/^\d{1,2}$/.test(digits)) continue;
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) continue;

    if (prefix === 'FWC') {
      if (n <= MAX_FWC) addVote(found, `FWC${n}`);
    } else if (TEAM_CODES.has(prefix)) {
      if (n <= TEAM_MAX_NUM) addVote(found, `${prefix}${n}`);
    }
  }

  // Pattern 2: MC + codigo de time (MC BRA, MC-BRA, MCBRA)
  const mcRegex = /\bMC[\s\-]?([A-Z]{2,5})\b/g;
  while ((m = mcRegex.exec(upper)) !== null) {
    const team = m[1];
    if (TEAM_CODES.has(team)) addVote(found, `MC-${team}`);
  }

  // Pattern 3: CAPA exato
  if (/\bCAPA\b/.test(upper)) addVote(found, 'CAPA');

  // Saneamento de ruido: se sair muito candidato (texto barulhento),
  // exige >=2 votos pra entrar no resultado final.
  let entries = [...found.entries()];
  if (entries.length > 40) entries = entries.filter(([, v]) => v >= 2);

  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.map(([code, votes]) => ({ code, votes }));
}

// Casa o texto contra o album. Cada resultado vem com sticker ja resolvido.
export function matchAll(text) {
  const out = [];
  for (const { code, votes } of extractCandidates(text)) {
    const sticker = ALL.get(code);
    if (sticker) out.push({ rawToken: code, sticker, dist: 0, votes });
  }
  return out;
}

// Casamento de UM token (usado em bulk-add manual). Sem fuzzy.
export function matchToken(token) {
  if (!token) return null;
  const compact = String(token).toUpperCase().replace(/[\s\-_]/g, '');
  if (ALL.has(compact)) return { sticker: ALL.get(compact), dist: 0 };
  // Tenta extrair como se fosse texto pequeno
  const cands = extractCandidates(token);
  if (cands.length > 0 && ALL.has(cands[0].code)) {
    return { sticker: ALL.get(cands[0].code), dist: 0 };
  }
  // Casa MC explicito
  if (compact.startsWith('MC')) {
    const key = 'MC-' + compact.slice(2);
    if (ALL.has(key)) return { sticker: ALL.get(key), dist: 0 };
  }
  return null;
}
