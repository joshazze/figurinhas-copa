import { teams } from './teams.js';

// Album oficial Panini Copa 2026 — TOTAL: 980 figurinhas (recorde).
//   - 912 normais (papel couché)
//   - 68 especiais (papel metalizado)
//
// Distribuicao usada aqui (totaliza 980 / 68 especiais):
//   - 1   capa                                   (especial)
//   - 19  aberturas/simbolos (FWC1..FWC19)       (especiais)
//   - 48  times × 20 figurinhas:
//         · 1 escudo                             (especial)  -> 48 especiais
//         · 1 foto da selecao                    (normal)
//         · 18 jogadores                         (normais)
//   = 1 + 19 + (48*20) = 980  /  especiais: 1 + 19 + 48 = 68 ✓
//
// Edite os nomes quando o album sair. O resto do app reage automaticamente.

const PLAYERS_PER_TEAM = 18;
const SPECIAL_INTROS = 19;

const placeholderName = (i) => `Jogador ${i + 1}`;

const cover = [
  { code: 'CAPA', name: 'Capa do Álbum', section: 'Capa', type: 'cover', special: true }
];

// 19 figurinhas especiais de abertura (trofeu, mascote, bola, logos, sedes-destaque etc.)
const introNames = [
  'Troféu da Copa', 'Mascote', 'Bola Oficial Adidas', 'Logotipo Copa 2026',
  'Logo FIFA', 'Pôster Oficial', 'Hino da Copa',
  'Estádio MetLife', 'SoFi Stadium', 'AT&T Stadium', 'Mercedes-Benz Stadium',
  'Lumen Field', 'Levi\'s Stadium', 'Hard Rock Stadium', 'NRG Stadium',
  'Arrowhead Stadium', 'BMO Field', 'BC Place', 'Estádio Azteca'
];
const intro = Array.from({ length: SPECIAL_INTROS }, (_, i) => ({
  code: `FWC${i + 1}`,
  name: introNames[i] || `Especial ${i + 1}`,
  section: 'Abertura',
  type: i < 7 ? 'intro' : 'stadium',
  special: true
}));

const teamStickers = teams.flatMap((team) => {
  const shield = {
    code: `${team.code}1`,
    name: `Escudo — ${team.name}`,
    section: team.name,
    team: team.code,
    type: 'shield',
    special: true
  };
  const groupPhoto = {
    code: `${team.code}2`,
    name: `Seleção — ${team.name}`,
    section: team.name,
    team: team.code,
    type: 'team-photo'
  };
  const players = Array.from({ length: PLAYERS_PER_TEAM }, (_, i) => ({
    code: `${team.code}${i + 3}`,
    name: placeholderName(i),
    section: team.name,
    team: team.code,
    type: 'player'
  }));
  return [shield, groupPhoto, ...players];
});

export const stickers = [...cover, ...intro, ...teamStickers];

export const totalStickers = stickers.length;
export const totalSpecial = stickers.filter((s) => s.special).length;
export const totalNormal = totalStickers - totalSpecial;

// Indices uteis
export const stickerByCode = Object.fromEntries(stickers.map((s) => [s.code, s]));

export const sectionsOrder = [
  'Capa',
  'Abertura',
  ...teams.map((t) => t.name)
];

export const stickersBySection = sectionsOrder
  .map((sec) => ({ section: sec, items: stickers.filter((s) => s.section === sec) }))
  .filter((g) => g.items.length > 0);

// === Coleção paralela: Seleções MC ===
// Conjunto promocional fora do álbum oficial Panini (não conta nos 980).
// 1 figurinha por seleção, etiquetada como "TIME 13" (ex.: "BRA 13").
// Codigo interno usa prefixo 'MC-' pra nao colidir com BRA13 (jogador).
export const MC_SECTION = 'Seleções MC';
export const mcStickers = teams.map((team) => ({
  code: `MC-${team.code}`,
  label: `${team.code} 13`,
  name: `${team.name} — MC`,
  section: MC_SECTION,
  team: team.code,
  type: 'mc-team',
  special: true,
  mc: true
}));
export const totalMcStickers = mcStickers.length;
export const mcStickerByCode = Object.fromEntries(mcStickers.map((s) => [s.code, s]));
