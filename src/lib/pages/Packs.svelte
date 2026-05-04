<script>
  import { appState, addPack, removePack, updateSettings } from '../stores/appState.svelte.js';
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
  let date = $state(new Date().toISOString().slice(0, 10));

  const fmt = (n) => `${appState.settings.currency} ${(n||0).toFixed(2).replace('.', ',')}`;

  function submit(e) {
    e.preventDefault();
    const c = parseFloat(String(cost).replace(',', '.'));
    if (!isFinite(c) || c < 0) return;
    const n = parseInt(count) || appState.settings.stickersPerPack;
    addPack({ cost: c, count: n, date: new Date(date).toISOString() });
    cost = defaultCostStr();
    count = '';
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="Histórico" title="Pacotes" />

  <!-- Stats -->
  <div class="px-5 grid grid-cols-2 gap-3">
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-400">abertos</div>
      <div class="num text-3xl text-white mt-1">{totalPacks()}</div>
      <div class="text-xs text-ink-400 mt-1">{totalStickersFromPacks()} figurinhas</div>
    </div>
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-400">gasto</div>
      <div class="num text-3xl text-lime-400 mt-1">{fmt(totalSpent())}</div>
      <div class="text-xs text-ink-400 mt-1">média {fmt(avgPackCost())}/pacote</div>
    </div>
  </div>

  <!-- Form -->
  <form class="px-5 mt-4" onsubmit={submit}>
    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-400">novo pacote</div>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <label class="block">
          <div class="text-xs text-ink-400 mb-1">Custo ({appState.settings.currency})</div>
          <input bind:value={cost} class="input mono" inputmode="decimal" placeholder="6,00" required />
        </label>
        <label class="block">
          <div class="text-xs text-ink-400 mb-1">Figurinhas</div>
          <input bind:value={count} class="input mono" inputmode="numeric" placeholder={appState.settings.stickersPerPack} />
        </label>
        <label class="block col-span-2">
          <div class="text-xs text-ink-400 mb-1">Data</div>
          <input bind:value={date} type="date" class="input mono" />
        </label>
      </div>
      <button type="submit" class="btn btn-primary w-full mt-3">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
        registrar pacote
      </button>
    </div>
  </form>

  <!-- Settings inline -->
  <div class="px-5 mt-4">
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-[11px] uppercase tracking-[0.18em] text-ink-400">padrão por pacote</div>
          <div class="text-sm text-ink-200 mt-1">{appState.settings.stickersPerPack} figurinhas</div>
        </div>
        <div class="flex items-center gap-1">
          <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10"
                  type="button"
                  onclick={() => updateSettings({ stickersPerPack: Math.max(1, appState.settings.stickersPerPack - 1) })}>−</button>
          <div class="num min-w-[2ch] text-center text-white">{appState.settings.stickersPerPack}</div>
          <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10"
                  type="button"
                  onclick={() => updateSettings({ stickersPerPack: appState.settings.stickersPerPack + 1 })}>+</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Lista -->
  <div class="px-5 mt-4">
    <h2 class="display text-base font-semibold text-white mb-2">Histórico</h2>
    {#if appState.packs.length === 0}
      <div class="card p-8 text-center text-ink-400">
        Nenhum pacote registrado ainda.
      </div>
    {:else}
      <div class="card divide-y divide-white/5">
        {#each appState.packs as p (p.id)}
          <div class="flex items-center gap-3 p-3">
            <div class="h-10 w-10 grid place-items-center rounded-xl bg-lime-400/15 border border-lime-400/30 text-lime-400">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4" stroke-linejoin="round"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-white">{fmt(p.cost)}</div>
              <div class="text-xs text-ink-400">{fmtDate(p.date)} · {p.count} figurinhas · {fmt(p.cost / Math.max(1,p.count))}/un</div>
            </div>
            <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 text-ink-400 hover:text-coral-400 hover:border-coral-400/30"
                    onclick={() => removePack(p.id)} type="button" aria-label="remover">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
