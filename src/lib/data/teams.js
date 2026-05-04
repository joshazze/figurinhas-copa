// 48 selecoes da Copa do Mundo 2026 (USA / Canada / Mexico).
// Grupos sao placeholders A-L (12 grupos de 4). Edite quando o sorteio sair.
// "code" e o prefixo da figurinha (3 letras) — escolhido pra bater com padrao Panini quando possivel.

export const teams = [
  // Anfitriões
  { code: 'CAN', name: 'Canadá',          flag: '🇨🇦', group: 'A', confed: 'CONCACAF' },
  { code: 'MEX', name: 'México',          flag: '🇲🇽', group: 'A', confed: 'CONCACAF' },
  { code: 'USA', name: 'Estados Unidos',  flag: '🇺🇸', group: 'D', confed: 'CONCACAF' },

  // CONMEBOL
  { code: 'ARG', name: 'Argentina',       flag: '🇦🇷', group: 'B', confed: 'CONMEBOL' },
  { code: 'BRA', name: 'Brasil',          flag: '🇧🇷', group: 'C', confed: 'CONMEBOL' },
  { code: 'URU', name: 'Uruguai',         flag: '🇺🇾', group: 'E', confed: 'CONMEBOL' },
  { code: 'COL', name: 'Colômbia',        flag: '🇨🇴', group: 'F', confed: 'CONMEBOL' },
  { code: 'ECU', name: 'Equador',         flag: '🇪🇨', group: 'G', confed: 'CONMEBOL' },
  { code: 'PAR', name: 'Paraguai',        flag: '🇵🇾', group: 'H', confed: 'CONMEBOL' },

  // UEFA
  { code: 'ESP', name: 'Espanha',         flag: '🇪🇸', group: 'B', confed: 'UEFA' },
  { code: 'FRA', name: 'França',          flag: '🇫🇷', group: 'C', confed: 'UEFA' },
  { code: 'ENG', name: 'Inglaterra',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'D', confed: 'UEFA' },
  { code: 'POR', name: 'Portugal',        flag: '🇵🇹', group: 'E', confed: 'UEFA' },
  { code: 'GER', name: 'Alemanha',        flag: '🇩🇪', group: 'F', confed: 'UEFA' },
  { code: 'ITA', name: 'Itália',          flag: '🇮🇹', group: 'G', confed: 'UEFA' },
  { code: 'NED', name: 'Holanda',         flag: '🇳🇱', group: 'H', confed: 'UEFA' },
  { code: 'BEL', name: 'Bélgica',         flag: '🇧🇪', group: 'I', confed: 'UEFA' },
  { code: 'CRO', name: 'Croácia',         flag: '🇭🇷', group: 'J', confed: 'UEFA' },
  { code: 'SUI', name: 'Suíça',           flag: '🇨🇭', group: 'K', confed: 'UEFA' },
  { code: 'AUT', name: 'Áustria',         flag: '🇦🇹', group: 'L', confed: 'UEFA' },
  { code: 'POL', name: 'Polônia',         flag: '🇵🇱', group: 'A', confed: 'UEFA' },
  { code: 'DEN', name: 'Dinamarca',       flag: '🇩🇰', group: 'B', confed: 'UEFA' },
  { code: 'NOR', name: 'Noruega',         flag: '🇳🇴', group: 'C', confed: 'UEFA' },
  { code: 'SCO', name: 'Escócia',         flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'D', confed: 'UEFA' },
  { code: 'TUR', name: 'Turquia',         flag: '🇹🇷', group: 'E', confed: 'UEFA' },
  { code: 'CZE', name: 'República Tcheca',flag: '🇨🇿', group: 'F', confed: 'UEFA' },

  // AFC
  { code: 'JPN', name: 'Japão',           flag: '🇯🇵', group: 'G', confed: 'AFC' },
  { code: 'KOR', name: 'Coreia do Sul',   flag: '🇰🇷', group: 'H', confed: 'AFC' },
  { code: 'IRN', name: 'Irã',             flag: '🇮🇷', group: 'I', confed: 'AFC' },
  { code: 'AUS', name: 'Austrália',       flag: '🇦🇺', group: 'J', confed: 'AFC' },
  { code: 'KSA', name: 'Arábia Saudita',  flag: '🇸🇦', group: 'K', confed: 'AFC' },
  { code: 'QAT', name: 'Catar',           flag: '🇶🇦', group: 'L', confed: 'AFC' },
  { code: 'IRQ', name: 'Iraque',          flag: '🇮🇶', group: 'A', confed: 'AFC' },
  { code: 'UZB', name: 'Uzbequistão',     flag: '🇺🇿', group: 'B', confed: 'AFC' },
  { code: 'JOR', name: 'Jordânia',        flag: '🇯🇴', group: 'C', confed: 'AFC' },

  // CAF
  { code: 'MAR', name: 'Marrocos',        flag: '🇲🇦', group: 'I', confed: 'CAF' },
  { code: 'SEN', name: 'Senegal',         flag: '🇸🇳', group: 'J', confed: 'CAF' },
  { code: 'EGY', name: 'Egito',           flag: '🇪🇬', group: 'K', confed: 'CAF' },
  { code: 'NGA', name: 'Nigéria',         flag: '🇳🇬', group: 'L', confed: 'CAF' },
  { code: 'CMR', name: 'Camarões',        flag: '🇨🇲', group: 'A', confed: 'CAF' },
  { code: 'ALG', name: 'Argélia',         flag: '🇩🇿', group: 'B', confed: 'CAF' },
  { code: 'TUN', name: 'Tunísia',         flag: '🇹🇳', group: 'C', confed: 'CAF' },
  { code: 'GHA', name: 'Gana',            flag: '🇬🇭', group: 'D', confed: 'CAF' },
  { code: 'CIV', name: 'Costa do Marfim', flag: '🇨🇮', group: 'E', confed: 'CAF' },

  // CONCACAF (não-anfitriões)
  { code: 'CRC', name: 'Costa Rica',      flag: '🇨🇷', group: 'F', confed: 'CONCACAF' },
  { code: 'JAM', name: 'Jamaica',         flag: '🇯🇲', group: 'G', confed: 'CONCACAF' },
  { code: 'PAN', name: 'Panamá',          flag: '🇵🇦', group: 'H', confed: 'CONCACAF' },

  // OFC
  { code: 'NZL', name: 'Nova Zelândia',   flag: '🇳🇿', group: 'I', confed: 'OFC' }
];
