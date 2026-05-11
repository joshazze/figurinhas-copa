<script>
  import {
    stickersBySection, totalStickers,
    mcStickers, totalMcStickers, MC_SECTION
  } from '../data/album.js';
  import {
    appState, setStickerCount, addSticker,
    addCommitment, knownPeople
  } from '../stores/appState.svelte.js';
  import { uniqueOwned } from '../stores/derived.svelte.js';
  import { formatStickerLabel, stickerSubtitle } from '../utils/format.js';
  import Header from '../components/Header.svelte';
  import StickerSlot from '../components/StickerSlot.svelte';

  let query = $state('');
  let filter = $state('all'); // all | missing | have

  // Sheet de acoes sobre uma figurinha (acionado via long-press)
  let activeSticker = $state(null);
  let person = $state('');
  let countInput = $state(0);

  function openSticker(sticker) {
    activeSticker = sticker;
    person = '';
    countInput = appState.collected[sticker.code] || 0;
  }
  function closeSticker() {
    activeSticker = null;
  }

  function bump(delta) {
    if (!activeSticker) return;
    addSticker(activeSticker.code, delta);
    countInput = appState.collected[activeSticker.code] || 0;
  }
  function commitSetCount() {
    if (!activeSticker) return;
    setStickerCount(activeSticker.code, Math.max(0, Math.floor(Number(countInput) || 0)));
  }
  function zero() {
    if (!activeSticker) return;
    setStickerCount(activeSticker.code, 0);
    closeSticker();
  }
  function promiseGive() {
    if (!activeSticker) return;
    addCommitment({ type: 'give', code: activeSticker.code, person });
    closeSticker();
  }
  function markExpect() {
    if (!activeSticker) return;
    addCommitment({ type: 'expect', code: activeSticker.code, person });
    closeSticker();
  }

  const peopleSuggestions = $derived(() => knownPeople());
  const currentCount = $derived(() => activeSticker ? (appState.collected[activeSticker.code] || 0) : 0);
  const extras = $derived(() => Math.max(0, currentCount() - 1));

  function applyFilters(items, q) {
    return items.filter((s) => {
      if (q) {
        const hay = `${s.code} ${s.label || ''} ${s.name} ${s.section}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const c = appState.collected[s.code] || 0;
      if (filter === 'missing' && c > 0) return false;
      if (filter === 'have' && c === 0) return false;
      return true;
    });
  }

  const sections = $derived(() => {
    const q = query.trim().toLowerCase();
    return stickersBySection
      .map((g) => ({ ...g, items: applyFilters(g.items, q) }))
      .filter((g) => g.items.length > 0);
  });

  const mcSection = $derived(() => {
    const q = query.trim().toLowerCase();
    const items = applyFilters(mcStickers, q);
    return { section: MC_SECTION, items };
  });

  const mcOwned = $derived(
    mcStickers.filter((s) => (appState.collected[s.code] || 0) > 0).length
  );
</script>

<section class="screen-enter pb-32">
  <Header sub="48 seleções · 980 figurinhas" title="{uniqueOwned()} / {totalStickers}">
    {#snippet right()}
      <div class="chip chip-lime">{((uniqueOwned()/totalStickers)*100).toFixed(1).replace('.', ',')}%</div>
    {/snippet}
  </Header>

  <!-- Dica -->
  <div class="px-5 mb-2 text-[11px] text-ink-400">
    Toque numa figurinha pra abrir o menu (somar, definir contagem, prometer, zerar).
  </div>

  <!-- Busca -->
  <div class="px-5">
    <div class="relative">
      <svg class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
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
          <div class="text-[11px] text-ink-300 mono">
            {g.items.filter(s => (appState.collected[s.code] || 0) > 0).length} / {g.items.length}
          </div>
        </div>
        <div class="grid grid-cols-5 gap-2">
          {#each g.items as s (s.code)}
            <StickerSlot sticker={s} onOpen={openSticker} />
          {/each}
        </div>
      </section>
    {/each}

    {#if sections().length === 0 && mcSection().items.length === 0}
      <div class="card p-8 text-center text-ink-300">
        Nenhuma figurinha encontrada com esses filtros.
      </div>
    {/if}

    {#if mcSection().items.length > 0}
      <section>
        <div class="flex items-end justify-between mb-2">
          <div class="flex items-center gap-2">
            <h2 class="display text-base font-semibold text-white">Seleções MC</h2>
            <span class="chip chip-sun">promo</span>
          </div>
          <div class="text-[11px] text-ink-300 mono">
            {mcOwned} / {totalMcStickers}
          </div>
        </div>
        <div class="text-[11px] text-ink-300 mb-2">
          Coleção paralela McDonald's — fora do álbum oficial.
        </div>
        <div class="grid grid-cols-5 gap-2">
          {#each mcSection().items as s (s.code)}
            <StickerSlot sticker={s} onOpen={openSticker} />
          {/each}
        </div>
      </section>
    {/if}
  </div>
</section>

<!-- ===== Sticker actions sheet (long-press) ===== -->
{#if activeSticker}
  <div class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onclick={closeSticker} role="presentation"></div>
  <div class="fixed inset-x-0 bottom-0 z-[61] px-3 pb-[max(0.6rem,var(--safe-bottom))]">
    <div class="card mx-auto max-w-md w-full p-5 tricolor-bar min-w-0"
         onclick={(e) => e.stopPropagation()} role="presentation">
      <!-- Header da figurinha -->
      <div class="flex items-center gap-3">
        <div class="h-14 w-14 grid place-items-center rounded-2xl bg-gold-400/15 border border-gold-400/35 mono text-gold-400 shrink-0">
          <span class="text-sm font-bold">{formatStickerLabel(activeSticker)}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="display text-2xl font-bold text-white tracking-tight leading-none">
            {formatStickerLabel(activeSticker)}
          </div>
          <div class="text-xs text-ink-300 truncate mt-1">{stickerSubtitle(activeSticker)}</div>
        </div>
        <button class="text-ink-300 text-xs underline" onclick={closeSticker} type="button">fechar</button>
      </div>

      <!-- Contagem -->
      <div class="mt-4 flex items-center gap-3">
        <button class="h-10 w-10 grid place-items-center rounded-xl bg-white/[0.06] border border-white/15 hover:bg-white/10"
                onclick={() => bump(-1)} type="button" aria-label="diminuir">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" stroke-linecap="round"/></svg>
        </button>
        <div class="flex-1 grid grid-cols-2 items-center gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300">tenho</div>
            <div class="num text-3xl text-white leading-none">{currentCount()}</div>
          </div>
          <div class="text-right">
            <div class="text-[10px] uppercase tracking-[0.18em] text-gold-400">extras</div>
            <div class="num text-3xl text-gold-400 leading-none">{extras()}</div>
          </div>
        </div>
        <button class="h-10 w-10 grid place-items-center rounded-xl bg-white/[0.06] border border-white/15 hover:bg-white/10"
                onclick={() => bump(1)} type="button" aria-label="aumentar">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Definir contagem exata -->
      <div class="mt-3 flex items-center gap-2">
        <label class="text-[10px] uppercase tracking-[0.18em] text-ink-300 shrink-0">definir</label>
        <input class="input !py-2 text-sm" type="number" min="0" step="1" bind:value={countInput} />
        <button class="btn btn-ghost !py-2 !px-3 text-xs whitespace-nowrap" onclick={commitSetCount} type="button">salvar</button>
      </div>

      <!-- Compromissos -->
      <div class="mt-4 space-y-2">
        <input class="input !py-2 text-sm" placeholder="Pessoa (apelido — pra prometer/esperar)"
               bind:value={person} list="album-people" type="text" />
        <datalist id="album-people">{#each peopleSuggestions() as p}<option value={p}></option>{/each}</datalist>
        <div class="grid grid-cols-2 gap-2">
          <button class="btn btn-primary !py-2.5 text-sm"
                  onclick={promiseGive}
                  disabled={currentCount() < 2}
                  type="button">
            prometer entregar
          </button>
          <button class="btn btn-gold !py-2.5 text-sm" onclick={markExpect} type="button">
            marcar esperada
          </button>
        </div>
        {#if currentCount() < 2}
          <div class="text-[10px] text-ink-400">prometer só faz sentido com 2+ (tem repetida)</div>
        {/if}
      </div>

      <!-- Zerar -->
      <button class="mt-4 w-full text-xs text-flag-400 underline opacity-80" onclick={zero} type="button">
        zerar essa figurinha
      </button>
    </div>
  </div>
{/if}
