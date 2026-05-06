<script>
  import { duplicates, totalDuplicates } from '../stores/derived.svelte.js';
  import { addSticker, setStickerCount } from '../stores/appState.svelte.js';
  import Header from '../components/Header.svelte';

  let query = $state('');
  const items = $derived(() => {
    const q = query.trim().toLowerCase();
    const list = duplicates();
    if (!q) return list;
    return list.filter(({ sticker, count }) =>
      `${sticker.code} ${sticker.name} ${sticker.section}`.toLowerCase().includes(q)
    );
  });
  const groupedBySection = $derived(() => {
    const map = new Map();
    for (const it of items()) {
      const key = it.sticker.section;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()].map(([section, list]) => ({ section, list }));
  });

  function shareList() {
    const list = duplicates()
      .map(({ sticker, count }) => `${sticker.code} (×${count - 1})`)
      .join(', ');
    const text = list ? `Tenho repetidas: ${list}` : 'Sem repetidas pra trocar.';
    if (navigator.share) {
      navigator.share({ title: 'Minhas repetidas', text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="Pra trocar com a galera" title="Repetidas">
    {#snippet right()}
      <button class="btn btn-ghost !py-2 !px-3 text-xs" onclick={shareList} type="button">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        compartilhar
      </button>
    {/snippet}
  </Header>

  <div class="px-5">
    <div class="card p-4 flex items-center justify-between">
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">total disponíveis</div>
        <div class="num text-3xl text-sun-400 mt-1">{totalDuplicates()}</div>
      </div>
      <div class="text-right">
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">títulos</div>
        <div class="num text-3xl text-white mt-1">{duplicates().length}</div>
      </div>
    </div>

    <div class="mt-4">
      <input
        bind:value={query}
        class="input"
        placeholder="Filtrar repetidas"
        type="search"
      />
    </div>
  </div>

  <div class="mt-4 px-5 space-y-5">
    {#each groupedBySection() as g (g.section)}
      <section>
        <h2 class="display text-base font-semibold text-white mb-2">{g.section}</h2>
        <div class="card divide-y divide-white/5">
          {#each g.list as { sticker, count, extras } (sticker.code)}
            <div class="flex items-center gap-3 p-3">
              <div class="h-10 w-10 grid place-items-center rounded-lg bg-sun-400/15 border border-sun-400/30 mono text-[11px] text-sun-400">
                {sticker.code}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-white truncate">{sticker.name}</div>
                <div class="text-xs text-ink-300">você tem ×{count}</div>
              </div>
              <div class="flex items-center gap-1">
                <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        onclick={() => addSticker(sticker.code, -1)} type="button" aria-label="diminuir">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" stroke-linecap="round"/></svg>
                </button>
                <div class="num min-w-[2ch] text-center text-sun-400 text-sm">+{extras}</div>
                <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        onclick={() => addSticker(sticker.code, 1)} type="button" aria-label="aumentar">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if groupedBySection().length === 0}
      <div class="card p-10 text-center text-ink-300">
        <div class="display text-lg text-white">Sem repetidas por aqui.</div>
        <div class="mt-1 text-sm">Quando bater alguma, ela aparece nesta lista.</div>
      </div>
    {/if}
  </div>
</section>
