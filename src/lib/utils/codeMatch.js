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

// Conta quantas vezes cada codigo aparece em um texto.
// Diferente de extractCandidates que dedupe — aqui conta ocorrencias.
function countOccurrences(text) {
  if (!text) return new Map();
  const found = new Map();
  const clean = String(text).replace(/[^\x20-\x7E\n\r\t]/g, ' ');

  const codeRegex = /\b([A-Za-z]{2,5})[\s\-]?([0-9OILSGBZoilsgbz]{1,2})\b/g;
  let m;
  while ((m = codeRegex.exec(clean)) !== null) {
    const prefixRaw = m[1];
    const digitsRaw = m[2];
    const letters = prefixRaw.match(/[A-Za-z]/g) || [];
    const upperCount = letters.filter((c) => c >= 'A' && c <= 'Z').length;
    if (letters.length === 0 || upperCount / letters.length < 0.8) continue;
    if (!/[0-9]/.test(digitsRaw)) continue;
    const prefix = prefixRaw.toUpperCase();
    const digits = fixDigits(digitsRaw.toUpperCase());
    if (!/^\d{1,2}$/.test(digits)) continue;
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) continue;

    let code = null;
    if (prefix === 'FWC' && n <= MAX_FWC) code = `FWC${n}`;
    else if (TEAM_CODES.has(prefix) && n <= TEAM_MAX_NUM) code = `${prefix}${n}`;
    if (code) found.set(code, (found.get(code) || 0) + 1);
  }

  const mcRegex = /\b(MC)[\s\-]?([A-Za-z]{2,5})\b/g;
  while ((m = mcRegex.exec(clean)) !== null) {
    const teamRaw = m[2];
    const letters = teamRaw.match(/[A-Za-z]/g) || [];
    const upperCount = letters.filter((c) => c >= 'A' && c <= 'Z').length;
    if (letters.length === 0 || upperCount / letters.length < 0.8) continue;
    const team = teamRaw.toUpperCase();
    if (TEAM_CODES.has(team)) {
      const code = `MC-${team}`;
      found.set(code, (found.get(code) || 0) + 1);
    }
  }

  const capaCount = (clean.match(/\bCAPA\b/g) || []).length;
  if (capaCount > 0) found.set('CAPA', capaCount);

  return found;
}

// Multi-pass voting com contagem de copias fisicas.
// Recebe lines [{ text, pass }], retorna [{ code, votes, passes, copies }]:
//   - votes: numero de PASSES distintos que detectaram o codigo
//   - copies: numero estimado de copias fisicas (max occurrences em um pass)
//
// Heuristica copies: se "BRA17" aparece 2x num pass, provavelmente sao 2
// stickers fisicos na foto. Usamos o MAX entre passes (nao a soma) porque
// cada pass ve a foto inteira do seu angulo.
export function matchAllWithPasses(lines) {
  const byPass = new Map();
  for (const l of lines || []) {
    const key = l.pass || 'default';
    if (!byPass.has(key)) byPass.set(key, []);
    byPass.get(key).push(l.text || '');
  }

  const codeToPasses = new Map();   // code -> Set<pass>
  const codeMaxCount = new Map();   // code -> max occurrences in any pass

  for (const [pass, texts] of byPass) {
    const combined = texts.join(' ');
    const occ = countOccurrences(combined);
    for (const [code, count] of occ) {
      if (!codeToPasses.has(code)) codeToPasses.set(code, new Set());
      codeToPasses.get(code).add(pass);
      codeMaxCount.set(code, Math.max(codeMaxCount.get(code) || 0, count));
    }
  }

  // Saneamento global: se mais de 30 codigos saem, exige 2+ passes
  let codes = [...codeToPasses.keys()];
  if (codes.length > 30) {
    codes = codes.filter((c) => codeToPasses.get(c).size >= 2);
  }

  const out = codes.map((code) => ({
    code,
    votes: codeToPasses.get(code).size,
    passes: [...codeToPasses.get(code)],
    copies: codeMaxCount.get(code) || 1
  }));
  return out;
}

// Chave de ordenacao das figurinhas:
//   CAPA primeiro, depois FWC (intro), depois times alfabeticos, MC por ultimo.
//   Dentro de cada grupo, ordena por numero crescente.
export function stickerSortKey(sticker) {
  if (!sticker) return ['z9', 99];
  if (sticker.code === 'CAPA') return ['0', 0];
  if (sticker.mc) return ['z_MC', sticker.team || 'ZZZ'];
  if (sticker.code.startsWith('FWC')) {
    return ['1_FWC', parseInt(sticker.code.slice(3), 10) || 0];
  }
  if (sticker.team) {
    const num = parseInt(sticker.code.replace(sticker.team, ''), 10);
    return ['2_' + sticker.team, isNaN(num) ? 0 : num];
  }
  return ['z9', 99];
}

export function compareStickers(a, b) {
  const ka = stickerSortKey(a);
  const kb = stickerSortKey(b);
  if (ka[0] !== kb[0]) return String(ka[0]).localeCompare(String(kb[0]));
  if (typeof ka[1] === 'number' && typeof kb[1] === 'number') return ka[1] - kb[1];
  return String(ka[1]).localeCompare(String(kb[1]));
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
