<script>
  let { title = '', sub = '', right = null, hosts = true } = $props();
</script>

<header class="px-5 pt-[max(1.25rem,calc(var(--safe-top)+0.5rem))] pb-3 flex items-end justify-between gap-3">
  <div class="min-w-0">
    <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-ink-300">
      {#if hosts}
        <span class="flex items-center gap-1">
          <span class="flag-mini flag-us" aria-label="USA"></span>
          <span class="flag-mini flag-ca" aria-label="Canadá"></span>
          <span class="flag-mini flag-mx" aria-label="México"></span>
        </span>
        <span class="text-ink-400">·</span>
      {/if}
      <span>{sub || 'Copa 2026'}</span>
    </div>
    <h1 class="display text-3xl font-bold text-white mt-1 leading-none">{title}</h1>
  </div>
  {#if right}
    <div class="flex items-center gap-2 shrink-0">{@render right()}</div>
  {/if}
</header>
