// Formatacao do "nome" das figurinhas usado para troca (BRA 17, FWC 4, MC BRA 13).
// O codigo interno (BRA17, FWC4, MC-BRA) e o que o app armazena; este helper
// devolve a forma que a galera usa pra falar das figurinhas no zap.

export function formatStickerLabel(sticker) {
  if (!sticker) return '';
  if (sticker.label) return sticker.label;          // MC stickers ja vem com label "BRA 13"
  if (sticker.code === 'CAPA') return 'CAPA';
  const m = sticker.code.match(/^([A-Z]+)(\d+)$/);  // BRA17 -> "BRA 17", FWC4 -> "FWC 4"
  if (m) return `${m[1]} ${m[2]}`;
  return sticker.code;
}

// Subtitulo curto descrevendo o que a figurinha e (sem repetir o codigo).
// Util como linha secundaria sem entulhar com "Jogador 4".
export function stickerSubtitle(sticker) {
  if (!sticker) return '';
  if (sticker.mc) return 'Promo McDonald’s';
  if (sticker.type === 'cover') return 'Capa do álbum';
  if (sticker.type === 'intro') return sticker.name;
  if (sticker.type === 'stadium') return sticker.name;
  if (sticker.type === 'shield') return `${sticker.section} · escudo`;
  if (sticker.type === 'team-photo') return `${sticker.section} · seleção`;
  if (sticker.type === 'player') return sticker.section;
  return sticker.section || '';
}
