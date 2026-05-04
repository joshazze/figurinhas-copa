<script>
  let { title = '', sub = '', right = null } = $props();
</script>

<header class="px-5 pt-[max(1.25rem,calc(var(--safe-top)+0.5rem))] pb-3 flex items-end justify-between gap-3">
  <div>
    <div class="text-[11px] uppercase tracking-[0.2em] text-ink-400">{sub}</div>
    <h1 class="display text-2xl font-bold text-white mt-0.5">{title}</h1>
  </div>
  {#if right}
    <div class="flex items-center gap-2">{@render right()}</div>
  {/if}
</header>
