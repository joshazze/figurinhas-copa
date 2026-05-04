<script>
  import { stickersBySection, totalStickers } from '../data/album.js';
  import { appState } from '../stores/appState.svelte.js';
  import { uniqueOwned } from '../stores/derived.svelte.js';
  import Header from '../components/Header.svelte';
  import StickerSlot from '../components/StickerSlot.svelte';

  let query = $state('');
  let filter = $state('all'); // all | missing | have

  const sections = $derived(() => {
    const q = query.trim().toLowerCase();
    return stickersBySection
      .map((g) => {
        const items = g.items.filter((s) => {
          if (q) {
            const hay = `${s.code} ${s.name} ${g.section}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          const c = appState.collected[s.code] || 0;
          if (filter === 'missing' && c > 0) return false;
          if (filter === 'have' && c === 0) return false;
          return true;
        });
        return { ...g, items };
      })
      .filter((g) => g.items.length > 0);
  });
</script>

<section class="screen-enter pb-32">
  <Header sub="Álbum" title="{uniqueOwned()} / {totalStickers}">
    {#snippet right()}
      <div class="chip chip-lime">{((uniqueOwned()/totalStickers)*100).toFixed(1).replace('.', ',')}%</div>
    {/snippet}
  </Header>

  <!-- Busca -->
  <div class="px-5">
    <div class="relative">
      <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/>
      </svg>
      <input
        bind:value={query}
        type="search"
        placeholder="Buscar figurinha (BRA1, jogador, time...)"
        class="input pl-10"
      />
    </div>

    <!-- Filtros -->
    <div class="mt-3 flex gap-2 overflow-x-auto scrollx -mx-5 px-5 pb-1">
      {#each [
        { id: 'all',     label: 'Todas' },
        { id: 'have',    label: 'Tenho' },
        { id: 'missing', label: 'Falta' }
      ] as f}
        <button
          type="button"
          class="chip {filter === f.id ? 'chip-lime' : ''}"
          onclick={() => filter = f.id}
        >{f.label}</button>
      {/each}
    </div>
  </div>

  <!-- Secoes -->
  <div class="mt-4 px-5 space-y-5">
    {#each sections() as g (g.section)}
      <section>
        <div class="flex items-end justify-between mb-2">
          <h2 class="display text-base font-semibold text-white">{g.section}</h2>
          <div class="text-[11px] text-ink-400 mono">
            {g.items.filter(s => (appState.collected[s.code] || 0) > 0).length} / {g.items.length}
          </div>
        </div>
        <div class="grid grid-cols-5 gap-2">
          {#each g.items as s (s.code)}
            <StickerSlot sticker={s} />
          {/each}
        </div>
      </section>
    {/each}

    {#if sections().length === 0}
      <div class="card p-8 text-center text-ink-400">
        Nenhuma figurinha encontrada com esses filtros.
      </div>
    {/if}
  </div>
</section>
