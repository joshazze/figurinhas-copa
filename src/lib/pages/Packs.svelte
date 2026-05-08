<script>
  import {
    appState, addPack, removePack,
    STICKERS_BY_SOURCE, defaultStickersForSource
  } from '../stores/appState.svelte.js';
  import {
    totalPacks, totalSpent, avgPackCost, totalStickersFromPacks, avgStickerCost
  } from '../stores/derived.svelte.js';
  import Header from '../components/Header.svelte';

  const defaultCostStr = () =>
    appState.settings.defaultPackPrice
      ? appState.settings.defaultPackPrice.toFixed(2).replace('.', ',')
      : '';

  let cost = $state(defaultCostStr());
  let count = $state('');
  let qty = $state('1');
  let source = $state('mc');
  let date = $state(new Date().toISOString().slice(0, 10));

  const fmt = (n) => `${appState.settings.currency} ${(n||0).toFixed(2).replace('.', ',')}`;

  const sourceLabel = (s) => (s === 'banca' ? 'banca' : 'mc');

  // Quantos figurinhas o input vai assumir caso fique vazio.
  const autoCount = $derived(defaultStickersForSource(source));
  const effectiveCount = $derived(parseInt(count) || autoCount);

  function pickSource(s) {
    source = s;
    // Limpa o count manual: força o auto-count da nova origem.
    count = '';
  }

  function submit(e) {
    e.preventDefault();
    const c = parseFloat(String(cost).replace(',', '.'));
    if (!isFinite(c) || c < 0) return;
    const n = parseInt(count) || defaultStickersForSource(source);
    const q = Math.max(1, parseInt(qty) || 1);
    addPack({ cost: c, count: n, qty: q, source, date: new Date(date).toISOString() });
    cost = defaultCostStr();
    count = '';
    qty = '1';
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="mc · 5 figurinhas  ·  banca · 7 figurinhas" title="Pacotes" />

  <!-- Stats -->
  <div class="px-5 grid grid-cols-2 gap-3">
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">abertos</div>
      <div class="num text-3xl text-white mt-1">{totalPacks()}</div>
      <div class="text-xs text-ink-300 mt-1">{totalStickersFromPacks()} figurinhas</div>
    </div>
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">gasto</div>
      <div class="num text-3xl text-flag-400 mt-1">{fmt(totalSpent())}</div>
      <div class="text-xs text-ink-300 mt-1">média {fmt(avgPackCost())}/pacote</div>
    </div>
  </div>

  <!-- Form -->
  <form class="px-5 mt-4" onsubmit={submit}>
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">novo pacote</div>
      <div class="mt-3 grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
        <button type="button"
                onclick={() => pickSource('mc')}
                class="h-9 rounded-lg text-xs uppercase tracking-[0.18em] font-semibold transition {source === 'mc' ? 'bg-flag-400 text-ink-900' : 'text-ink-300 hover:text-white'}">
          mc · 5
        </button>
        <button type="button"
                onclick={() => pickSource('banca')}
                class="h-9 rounded-lg text-xs uppercase tracking-[0.18em] font-semibold transition {source === 'banca' ? 'bg-flag-400 text-ink-900' : 'text-ink-300 hover:text-white'}">
          banca · 7
        </button>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <label class="block">
          <div class="text-xs text-ink-300 mb-1">Custo unit. ({appState.settings.currency})</div>
          <input bind:value={cost} class="input mono" inputmode="decimal" placeholder="6,00" required />
        </label>
        <label class="block">
          <div class="text-xs text-ink-300 mb-1">Figurinhas/pacote</div>
          <input bind:value={count} class="input mono" inputmode="numeric" placeholder={`auto · ${autoCount}`} />
        </label>
        <label class="block">
          <div class="text-xs text-ink-300 mb-1">Qtd. pacotes</div>
          <input bind:value={qty} class="input mono" inputmode="numeric" min="1" placeholder="1" />
        </label>
        <label class="block">
          <div class="text-xs text-ink-300 mb-1">Data</div>
          <input bind:value={date} type="date" class="input mono" />
        </label>
      </div>
      {#if (parseInt(qty) || 1) > 1 && parseFloat(String(cost).replace(',', '.')) > 0}
        <div class="mt-3 text-xs text-ink-300">
          total: <span class="text-lime-400 num">{fmt((parseFloat(String(cost).replace(',', '.')) || 0) * (parseInt(qty) || 1))}</span>
          · <span class="text-white num">{effectiveCount * (parseInt(qty) || 1)}</span> figurinhas
        </div>
      {/if}
      <button type="submit" class="btn btn-primary w-full mt-3">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        {(parseInt(qty) || 1) > 1 ? `registrar ${parseInt(qty) || 1} pacotes` : 'registrar pacote'}
      </button>
    </div>
  </form>

  <!-- Defaults por origem (somente leitura: oficial Panini Copa 2026) -->
  <div class="px-5 mt-4">
    <div class="card p-4 grid grid-cols-2 gap-3">
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">mc</div>
        <div class="num text-2xl text-white mt-1">{STICKERS_BY_SOURCE.mc}</div>
        <div class="text-[10px] text-ink-300 mt-0.5">figurinhas/pacote</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">banca</div>
        <div class="num text-2xl text-white mt-1">{STICKERS_BY_SOURCE.banca}</div>
        <div class="text-[10px] text-ink-300 mt-0.5">figurinhas/pacote</div>
      </div>
    </div>
  </div>

  <!-- Lista -->
  <div class="px-5 mt-4">
    <h2 class="display text-base font-semibold text-white mb-2">Histórico</h2>
    {#if appState.packs.length === 0}
      <div class="card p-8 text-center text-ink-300">
        Nenhum pacote registrado ainda.
      </div>
    {:else}
      <div class="card divide-y divide-white/5">
        {#each appState.packs as p (p.id)}
          <div class="flex items-center gap-3 p-3">
            <div class="h-10 w-10 grid place-items-center rounded-xl bg-flag-400/15 border border-flag-400/30 text-flag-400">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4" stroke-linejoin="round"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-white">
                {#if (p.qty || 1) > 1}
                  <span class="text-ink-200">{p.qty}×</span> {fmt(p.cost)}
                  <span class="text-ink-300">=</span>
                  <span class="text-lime-400">{fmt(p.cost * (p.qty || 1))}</span>
                {:else}
                  {fmt(p.cost)}
                {/if}
              </div>
              <div class="text-xs text-ink-300 flex items-center gap-1.5 flex-wrap">
                <span class="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-200">{sourceLabel(p.source)}</span>
                <span>{fmtDate(p.date)} · {p.count * (p.qty || 1)} figurinhas · {fmt(p.cost / Math.max(1,p.count))}/un</span>
              </div>
            </div>
            <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-ink-300 hover:text-coral-400 hover:border-coral-400/30"
                    onclick={() => removePack(p.id)} type="button" aria-label="remover">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
