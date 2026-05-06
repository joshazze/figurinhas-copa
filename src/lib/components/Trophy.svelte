<script>
  let { size = 56, glow = true } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true"
     style={glow ? 'filter: drop-shadow(0 0 18px rgba(251,191,36,0.55));' : ''}>
  <defs>
    <linearGradient id="trophy-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#fde68a"/>
      <stop offset="55%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="trophy-globe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#fcd34d"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>

  <!-- Globo estilizado (referência ao troféu da Copa) -->
  <ellipse cx="32" cy="22" rx="13" ry="14" fill="url(#trophy-globe)" stroke="#92400e" stroke-width="0.6"/>
  <path d="M19 22 Q32 14 45 22" stroke="#b45309" stroke-width="0.8" fill="none" opacity="0.7"/>
  <path d="M19 22 Q32 30 45 22" stroke="#b45309" stroke-width="0.8" fill="none" opacity="0.7"/>
  <ellipse cx="32" cy="22" rx="4" ry="14" fill="none" stroke="#b45309" stroke-width="0.8" opacity="0.7"/>

  <!-- Suporte/colunas -->
  <path d="M22 33 Q22 42 28 46 L36 46 Q42 42 42 33 Z" fill="url(#trophy-gold)" stroke="#92400e" stroke-width="0.5"/>

  <!-- Base -->
  <rect x="24" y="46" width="16" height="3" rx="0.6" fill="url(#trophy-gold)" stroke="#92400e" stroke-width="0.4"/>
  <rect x="20" y="50" width="24" height="5" rx="1" fill="url(#trophy-gold)" stroke="#92400e" stroke-width="0.5"/>
  <rect x="17" y="56" width="30" height="3" rx="0.8" fill="url(#trophy-gold)" stroke="#92400e" stroke-width="0.4"/>

  <!-- Brilho -->
  <path d="M28 12 Q30 18 32 12" stroke="#fff8dc" stroke-width="0.8" fill="none" opacity="0.6"/>
</svg>
