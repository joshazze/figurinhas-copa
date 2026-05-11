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
  let costMode = $state('unit');         // 'unit' = preco/pacote · 'lot' = total
  let count = $state('');
  let qty = $state('1');
  let source = $state('mc');
  let date = $state(new Date().toISOString().slice(0, 10));

  const fmt = (n) => `${appState.settings.currency} ${(n||0).toFixed(2).replace('.', ',')}`;
  const parsedCost = $derived(() => parseFloat(String(cost).replace(',', '.')) || 0);
  const parsedQty = $derived(() => Math.max(1, parseInt(qty) || 1));
  const unitCost = $derived(() => costMode === 'lot' ? parsedCost() / parsedQty() : parsedCost());
  const totalCost = $derived(() => costMode === 'lot' ? parsedCost() : parsedCost() * parsedQty());

  const autoCount = $derived(defaultStickersForSource(source));
  const effectiveCount = $derived(parseInt(count) || autoCount);

  function pickSource(s) {
    source = s;
    count = '';
  }

  function submit(e) {
    e.preventDefault();
    const raw = parseFloat(String(cost).replace(',', '.'));
    if (!isFinite(raw) || raw < 0) return;
    const n = parseInt(count) || defaultStickersForSource(source);
    const q = Math.max(1, parseInt(qty) || 1);
    const unit = costMode === 'lot' ? raw / q : raw;
    addPack({ cost: unit, count: n, qty: q, source, date: new Date(date).toISOString() });
    cost = defaultCostStr();
    count = '';
    qty = '1';
    costMode = 'unit';
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="Histórico de aberturas" title="Pacotes" />

  <!-- Stats compactos: 1 linha de 3 numeros -->
  <div class="px-5">
    <div class="card p-4 grid grid-cols-3 gap-2 text-center">
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">abertos</div>
        <div class="num text-2xl text-white mt-1 leading-none">{totalPacks()}</div>
      </div>
      <div class="border-x border-white/10">
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">figurinhas</div>
        <div class="num text-2xl text-pitch-400 mt-1 leading-none">{totalStickersFromPacks()}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">gasto</div>
        <div class="num text-2xl text-flag-400 mt-1 leading-none truncate" title={fmt(totalSpent())}>
          {fmt(totalSpent())}
        </div>
      </div>
    </div>
    {#if totalPacks() > 0}
      <div class="mt-2 text-center text-[10px] text-ink-400">
        média {fmt(avgPackCost())}/pacote · {fmt(avgStickerCost())}/figurinha
      </div>
    {/if}
  </div>

  <!-- FORM: registrar novo pacote -->
  <form class="px-5 mt-5" onsubmit={submit}>
    <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-2 px-1">novo registro</div>
    <div class="card p-4 space-y-3">
      <!-- Origem (segmented) -->
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-1.5">origem</div>
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          <button type="button"
                  onclick={() => pickSource('mc')}
                  class="h-10 rounded-lg text-xs uppercase tracking-[0.14em] font-bold transition flex items-center justify-center gap-1.5
                         {source === 'mc' ? 'bg-flag-400 text-ink-950' : 'text-ink-300 hover:text-white'}">
            🍔 mc <span class="opacity-70 normal-case font-normal">· 5 fig</span>
          </button>
          <button type="button"
                  onclick={() => pickSource('banca')}
                  class="h-10 rounded-lg text-xs uppercase tracking-[0.14em] font-bold transition flex items-center justify-center gap-1.5
                         {source === 'banca' ? 'bg-flag-400 text-ink-950' : 'text-ink-300 hover:text-white'}">
            🏪 banca <span class="opacity-70 normal-case font-normal">· 7 fig</span>
          </button>
        </div>
      </div>

      <!-- Preço com toggle inline discreto -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">preço ({appState.settings.currency})</div>
          <div class="flex gap-0.5 text-[10px] uppercase tracking-wide">
            <button type="button" onclick={() => costMode = 'unit'}
                    class="px-2 py-0.5 rounded transition {costMode === 'unit' ? 'bg-flag-400/20 text-flag-400' : 'text-ink-400'}">
              unit.
            </button>
            <button type="button" onclick={() => costMode = 'lot'}
                    class="px-2 py-0.5 rounded transition {costMode === 'lot' ? 'bg-flag-400/20 text-flag-400' : 'text-ink-400'}">
              lote
            </button>
          </div>
        </div>
        <input bind:value={cost} class="input mono text-base" inputmode="decimal"
               placeholder={costMode === 'lot' ? `${appState.settings.currency} 30,00 (lote inteiro)` : `${appState.settings.currency} 6,00 (por pacote)`}
               required />
      </div>

      <!-- Qtd + Data + Figurinhas/pacote (todos opcionais, lado a lado) -->
      <div class="grid grid-cols-3 gap-2">
        <div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-1.5">qtd</div>
          <input bind:value={qty} class="input mono text-sm !py-2" inputmode="numeric" min="1" placeholder="1" />
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-1.5">fig/pct</div>
          <input bind:value={count} class="input mono text-sm !py-2" inputmode="numeric" placeholder={`${autoCount}`} />
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300 mb-1.5">data</div>
          <input bind:value={date} type="date" class="input mono text-sm !py-2" />
        </div>
      </div>

      <!-- Preview total -->
      {#if parsedCost() > 0}
        <div class="rounded-xl bg-white/[0.04] border border-white/[0.08] p-2.5 text-center">
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">total</div>
          <div class="mt-0.5">
            <span class="num text-xl text-pitch-400">{fmt(totalCost())}</span>
            {#if parsedQty() > 1}
              <span class="text-[11px] text-ink-300 ml-1">· {fmt(unitCost())}/pct</span>
            {/if}
          </div>
          <div class="text-[10px] text-ink-400 mt-0.5">{effectiveCount * parsedQty()} figurinhas</div>
        </div>
      {/if}

      <button type="submit" class="btn btn-primary w-full">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        registrar {(parseInt(qty) || 1) > 1 ? `${parseInt(qty)} pacotes` : 'pacote'}
      </button>
    </div>
  </form>

  <!-- HISTÓRICO -->
  <div class="px-5 mt-5">
    <div class="flex items-end justify-between mb-2 px-1">
      <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">histórico</div>
      {#if appState.packs.length > 0}
        <div class="text-[10px] text-ink-400 mono">{appState.packs.length} registros</div>
      {/if}
    </div>
    {#if appState.packs.length === 0}
      <div class="card p-8 text-center text-ink-300">
        <div class="text-sm">Nenhum pacote registrado ainda.</div>
        <div class="text-[11px] text-ink-400 mt-1">Use o form acima pra adicionar.</div>
      </div>
    {:else}
      <div class="card divide-y divide-white/5">
        {#each appState.packs as p (p.id)}
          <div class="flex items-center gap-3 p-3">
            <div class="h-10 w-10 grid place-items-center rounded-xl
                        {p.source === 'mc' ? 'bg-gold-400/12 border border-gold-400/30 text-gold-400' : 'bg-sky26-400/12 border border-sky26-400/30 text-sky26-400'}">
              <span class="text-sm">{p.source === 'mc' ? '🍔' : '🏪'}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-white">
                {#if (p.qty || 1) > 1}
                  <span class="text-ink-200">{p.qty}×</span> <span class="text-lime-400">{fmt(p.cost * (p.qty || 1))}</span>
                  <span class="text-ink-400 text-xs">({fmt(p.cost)}/pct)</span>
                {:else}
                  <span class="text-lime-400">{fmt(p.cost)}</span>
                {/if}
              </div>
              <div class="text-xs text-ink-300 mt-0.5">
                {fmtDate(p.date)} · {p.count * (p.qty || 1)} figurinhas
              </div>
            </div>
            <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-ink-400 hover:text-flag-400 hover:border-flag-400/30 shrink-0"
                    onclick={() => removePack(p.id)} type="button" aria-label="remover">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
