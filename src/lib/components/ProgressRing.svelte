<script>
  let { value = 0, size = 220, stroke = 14, label = '', sub = '' } = $props();

  const radius = $derived((size - stroke) / 2);
  const circ = $derived(2 * Math.PI * radius);
  const clamped = $derived(Math.max(0, Math.min(100, value)));
  const offset = $derived(circ * (1 - clamped / 100));
</script>

<div class="relative grid place-items-center" style="width:{size}px;height:{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
    <defs>
      <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#c8ff3d" />
        <stop offset="55%" stop-color="#ffd35a" />
        <stop offset="100%" stop-color="#ff6b6b" />
      </linearGradient>
      <filter id="ring-blur"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>

    <!-- Glow -->
    <circle cx={size/2} cy={size/2} r={radius}
            stroke="url(#ring-grad)" stroke-width={stroke} fill="none"
            stroke-dasharray={circ} stroke-dashoffset={offset}
            stroke-linecap="round" filter="url(#ring-blur)" opacity="0.55"
            class="ring-fill" />

    <!-- Trilho -->
    <circle cx={size/2} cy={size/2} r={radius}
            stroke="rgba(255,255,255,0.06)" stroke-width={stroke} fill="none" />

    <!-- Progresso -->
    <circle cx={size/2} cy={size/2} r={radius}
            stroke="url(#ring-grad)" stroke-width={stroke} fill="none"
            stroke-dasharray={circ} stroke-dashoffset={offset}
            stroke-linecap="round" class="ring-fill" />
  </svg>

  <div class="absolute inset-0 grid place-items-center text-center">
    <div>
      <div class="num text-5xl text-white">{clamped.toFixed(1).replace('.', ',')}<span class="text-2xl text-ink-400">%</span></div>
      {#if label}<div class="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{label}</div>{/if}
      {#if sub}<div class="mt-2 text-sm text-ink-200/80">{sub}</div>{/if}
    </div>
  </div>
</div>
