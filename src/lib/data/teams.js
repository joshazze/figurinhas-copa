// 48 selecoes oficialmente classificadas para a Copa do Mundo 2026
// (USA / Canada / Mexico). Verificado em 2026-05-04 (FIFA + ESPN + Wikipedia).
//
// Distribuicao final:
//   CONCACAF (6): 3 anfitrioes + Panama, Curacao, Haiti
//   CONMEBOL (6): Argentina, Brasil, Equador, Uruguai, Colombia, Paraguai
//   UEFA    (16)
//   AFC      (9): 8 diretos + Iraque (playoff intercontinental)
//   CAF     (10): 9 diretos + RD Congo (playoff intercontinental)
//   OFC      (1): Nova Zelandia
//
// Estreias historicas:
//   - Curacao (CONCACAF, primeiro pais nao-soberano desde Indias Holandesas/1938)
//   - Cabo Verde (CAF), Uzbequistao (AFC), Jordania (AFC)
//
// Grupos A-L sao placeholders ate o sorteio oficial.

export const teams = [
  // === Anfitrioes (CONCACAF) ===
  { code: 'CAN', name: 'Canadá',           flag: '🇨🇦', group: 'A', confed: 'CONCACAF' },
  { code: 'MEX', name: 'México',           flag: '🇲🇽', group: 'A', confed: 'CONCACAF' },
  { code: 'USA', name: 'Estados Unidos',   flag: '🇺🇸', group: 'D', confed: 'CONCACAF' },

  // === CONCACAF (qualificados) ===
  { code: 'PAN', name: 'Panamá',           flag: '🇵🇦', group: 'B', confed: 'CONCACAF' },
  { code: 'CUW', name: 'Curaçao',          flag: '🇨🇼', group: 'C', confed: 'CONCACAF' },
  { code: 'HAI', name: 'Haiti',            flag: '🇭🇹', group: 'E', confed: 'CONCACAF' },

  // === CONMEBOL ===
  { code: 'ARG', name: 'Argentina',        flag: '🇦🇷', group: 'B', confed: 'CONMEBOL' },
  { code: 'BRA', name: 'Brasil',           flag: '🇧🇷', group: 'C', confed: 'CONMEBOL' },
  { code: 'URU', name: 'Uruguai',          flag: '🇺🇾', group: 'D', confed: 'CONMEBOL' },
  { code: 'COL', name: 'Colômbia',         flag: '🇨🇴', group: 'E', confed: 'CONMEBOL' },
  { code: 'ECU', name: 'Equador',          flag: '🇪🇨', group: 'F', confed: 'CONMEBOL' },
  { code: 'PAR', name: 'Paraguai',         flag: '🇵🇾', group: 'G', confed: 'CONMEBOL' },

  // === UEFA (16) ===
  { code: 'ESP', name: 'Espanha',          flag: '🇪🇸', group: 'F', confed: 'UEFA' },
  { code: 'FRA', name: 'França',           flag: '🇫🇷', group: 'G', confed: 'UEFA' },
  { code: 'ENG', name: 'Inglaterra',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'H', confed: 'UEFA' },
  { code: 'POR', name: 'Portugal',         flag: '🇵🇹', group: 'H', confed: 'UEFA' },
  { code: 'GER', name: 'Alemanha',         flag: '🇩🇪', group: 'I', confed: 'UEFA' },
  { code: 'NED', name: 'Holanda',          flag: '🇳🇱', group: 'I', confed: 'UEFA' },
  { code: 'BEL', name: 'Bélgica',          flag: '🇧🇪', group: 'J', confed: 'UEFA' },
  { code: 'CRO', name: 'Croácia',          flag: '🇭🇷', group: 'J', confed: 'UEFA' },
  { code: 'SUI', name: 'Suíça',            flag: '🇨🇭', group: 'K', confed: 'UEFA' },
  { code: 'AUT', name: 'Áustria',          flag: '🇦🇹', group: 'K', confed: 'UEFA' },
  { code: 'NOR', name: 'Noruega',          flag: '🇳🇴', group: 'L', confed: 'UEFA' },
  { code: 'SCO', name: 'Escócia',          flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'L', confed: 'UEFA' },
  { code: 'TUR', name: 'Turquia',          flag: '🇹🇷', group: 'A', confed: 'UEFA' },
  { code: 'CZE', name: 'Tchéquia',         flag: '🇨🇿', group: 'B', confed: 'UEFA' },
  { code: 'BIH', name: 'Bósnia',           flag: '🇧🇦', group: 'C', confed: 'UEFA' },
  { code: 'SWE', name: 'Suécia',           flag: '🇸🇪', group: 'D', confed: 'UEFA' },

  // === AFC (9, inclui Iraque via playoff) ===
  { code: 'JPN', name: 'Japão',            flag: '🇯🇵', group: 'E', confed: 'AFC' },
  { code: 'IRN', name: 'Irã',              flag: '🇮🇷', group: 'F', confed: 'AFC' },
  { code: 'KOR', name: 'Coreia do Sul',    flag: '🇰🇷', group: 'G', confed: 'AFC' },
  { code: 'AUS', name: 'Austrália',        flag: '🇦🇺', group: 'H', confed: 'AFC' },
  { code: 'KSA', name: 'Arábia Saudita',   flag: '🇸🇦', group: 'I', confed: 'AFC' },
  { code: 'QAT', name: 'Catar',            flag: '🇶🇦', group: 'J', confed: 'AFC' },
  { code: 'UZB', name: 'Uzbequistão',      flag: '🇺🇿', group: 'K', confed: 'AFC' },
  { code: 'JOR', name: 'Jordânia',         flag: '🇯🇴', group: 'L', confed: 'AFC' },
  { code: 'IRQ', name: 'Iraque',           flag: '🇮🇶', group: 'A', confed: 'AFC' },

  // === CAF (10, inclui RD Congo via playoff) ===
  { code: 'MAR', name: 'Marrocos',         flag: '🇲🇦', group: 'B', confed: 'CAF' },
  { code: 'SEN', name: 'Senegal',          flag: '🇸🇳', group: 'C', confed: 'CAF' },
  { code: 'EGY', name: 'Egito',            flag: '🇪🇬', group: 'D', confed: 'CAF' },
  { code: 'CIV', name: 'Costa do Marfim',  flag: '🇨🇮', group: 'E', confed: 'CAF' },
  { code: 'GHA', name: 'Gana',             flag: '🇬🇭', group: 'F', confed: 'CAF' },
  { code: 'TUN', name: 'Tunísia',          flag: '🇹🇳', group: 'G', confed: 'CAF' },
  { code: 'ALG', name: 'Argélia',          flag: '🇩🇿', group: 'H', confed: 'CAF' },
  { code: 'RSA', name: 'África do Sul',    flag: '🇿🇦', group: 'I', confed: 'CAF' },
  { code: 'CPV', name: 'Cabo Verde',       flag: '🇨🇻', group: 'J', confed: 'CAF' },
  { code: 'COD', name: 'RD Congo',         flag: '🇨🇩', group: 'K', confed: 'CAF' },

  // === OFC ===
  { code: 'NZL', name: 'Nova Zelândia',    flag: '🇳🇿', group: 'L', confed: 'OFC' }
];
