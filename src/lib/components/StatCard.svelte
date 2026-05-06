<script>
  let { label = '', value = '', sub = '', accent = 'flag', icon = null } = $props();

  const accentMap = {
    flag:  'from-flag-400/20  to-transparent text-flag-400',
    sky:   'from-sky26-400/20 to-transparent text-sky26-400',
    pitch: 'from-pitch-400/20 to-transparent text-pitch-400',
    gold:  'from-gold-400/25  to-transparent text-gold-400',
    ink:   'from-white/[0.06] to-transparent text-ink-200',
    // legados
    lime:  'from-pitch-400/20 to-transparent text-pitch-400',
    sun:   'from-gold-400/25  to-transparent text-gold-400',
    coral: 'from-flag-400/20  to-transparent text-flag-400'
  };
</script>

<div class="card grain p-4">
  <div class="flex items-center justify-between">
    <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</div>
    {#if icon}
      <div class="h-7 w-7 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-ink-200">
        {@html icon}
      </div>
    {/if}
  </div>
  <div class="mt-2 num text-3xl text-white">{value}</div>
  {#if sub}<div class="mt-1 text-xs text-ink-300">{sub}</div>{/if}

  <div class="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r {accentMap[accent] || accentMap.flag}"></div>
</div>
