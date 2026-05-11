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
  const up = s.toUpperCase();
  return up.split('').map((c) => DIGIT_FIX[c] ?? c).join('');
}

function addVote(map, code) {
  map.set(code, (map.get(code) || 0) + 1);
}

// Verifica se um trecho de letras e "majoritariamente uppercase".
// Codigos da Panini sao SEMPRE CAIXA-ALTA. Texto legal/multilingue do verso
// vem em case misto ou minuscula. Esse filtro elimina ~todo o ruido sem
// precisar de regex semantico complexo.
function isUpperish(s, minRatio = 0.6) {
  const letters = s.match(/[A-Za-z]/g);
  if (!letters || letters.length === 0) return false;
  let upper = 0;
  for (const c of letters) if (c >= 'A' && c <= 'Z') upper++;
  return upper / letters.length >= minRatio;
}

// Extrai candidatos validos do texto bruto.
// Retorna [{ code, votes }] ordenado por votos desc.
export function extractCandidates(text) {
  if (!text) return [];
  const found = new Map();
  // Sanitiza minimo: mantem case original, remove apenas controles exoticos
  const clean = String(text).replace(/[^\x20-\x7E\n\r\t]/g, ' ');

  // Pattern 1: prefixo (qualquer case na regex) + sep opcional + digito/letra-conf
  // Mas exigimos no codigo que o prefixo seja UPPER (signal de codigo Panini).
  const codeRegex = /\b([A-Za-z]{2,5})[\s\-]?([0-9OILSGBZoilsgbz]{1,2})\b/g;
  let m;
  while ((m = codeRegex.exec(clean)) !== null) {
    const prefixRaw = m[1];
    const digitsRaw = m[2];
    // SO uppercase passa — codigos Panini sao todos em maiuscula
    if (!isUpperish(prefixRaw, 0.8)) continue;
    // o "numero" precisa ter ao menos um digito real
    if (!/[0-9]/.test(digitsRaw)) continue;
    const prefix = prefixRaw.toUpperCase();
    const digits = fixDigits(digitsRaw.toUpperCase());
    if (!/^\d{1,2}$/.test(digits)) continue;
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) continue;

    if (prefix === 'FWC') {
      if (n <= MAX_FWC) addVote(found, `FWC${n}`);
    } else if (TEAM_CODES.has(prefix)) {
      if (n <= TEAM_MAX_NUM) addVote(found, `${prefix}${n}`);
    }
  }

  // Pattern 2: MC + codigo de time, com o mesmo filtro de case
  const mcRegex = /\b(MC)[\s\-]?([A-Za-z]{2,5})\b/g;
  while ((m = mcRegex.exec(clean)) !== null) {
    const mcRaw = m[1];
    const teamRaw = m[2];
    if (!isUpperish(mcRaw, 1) || !isUpperish(teamRaw, 0.8)) continue;
    const team = teamRaw.toUpperCase();
    if (TEAM_CODES.has(team)) addVote(found, `MC-${team}`);
  }

  // Pattern 3: CAPA exato (uppercase)
  if (/\bCAPA\b/.test(clean)) addVote(found, 'CAPA');

  // Saneamento: se sair muito candidato (foto barulhenta), exige >=2 votos
  let entries = [...found.entries()];
  if (entries.length > 25) entries = entries.filter(([, v]) => v >= 2);

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
