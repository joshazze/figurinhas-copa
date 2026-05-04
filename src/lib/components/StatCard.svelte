<script>
  let { label = '', value = '', sub = '', accent = 'lime', icon = null } = $props();

  const accentMap = {
    lime: 'from-lime-400/15 to-transparent text-lime-400',
    sun:  'from-sun-400/15  to-transparent text-sun-400',
    coral:'from-coral-400/15 to-transparent text-coral-400',
    ink:  'from-white/[0.06] to-transparent text-ink-200'
  };
</script>

<div class="card grain p-4">
  <div class="flex items-center justify-between">
    <div class="text-[11px] uppercase tracking-[0.18em] text-ink-400">{label}</div>
    {#if icon}
      <div class="h-7 w-7 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-ink-200">
        {@html icon}
      </div>
    {/if}
  </div>
  <div class="mt-2 num text-3xl text-white">{value}</div>
  {#if sub}<div class="mt-1 text-xs text-ink-400">{sub}</div>{/if}

  <div class="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r {accentMap[accent]}"></div>
</div>
