<script>
  import { appState, clearLogs } from '../stores/appState.svelte.js';
  import { stickerByCode, mcStickerByCode } from '../data/album.js';
  import Header from '../components/Header.svelte';

  let query = $state('');
  let filter = $state('all'); // all | sticker | pack

  const fmt = (n) => `${appState.settings.currency} ${(n||0).toFixed(2).replace('.', ',')}`;

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function dayKey(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: 'short'
    });
  }

  function lookup(code) {
    return stickerByCode[code] || mcStickerByCode[code] || null;
  }

  // Classes Tailwind precomputadas (JIT precisa ver os nomes literais).
  const ACCENTS = {
    pitch:  'bg-pitch-400/15 border-pitch-400/30 text-pitch-400',
    flag:   'bg-flag-400/15 border-flag-400/30 text-flag-400',
    gold:   'bg-gold-400/15 border-gold-400/30 text-gold-400',
    sky:    'bg-sky26-400/15 border-sky26-400/30 text-sky26-400'
  };

  function describeSticker(log) {
    const s = lookup(log.code);
    const display = s?.label || s?.code || log.code;
    const name = s?.name || '';
    const { prev = 0, next = 0 } = log;
    let action, accentKey;
    if (prev === 0 && next > 0) {
      action = `marcou`;
      accentKey = 'pitch';
    } else if (next === 0 && prev > 0) {
      action = `zerou`;
      accentKey = 'flag';
    } else if (next > prev) {
      action = `+${next - prev} repetida`;
      accentKey = 'gold';
    } else {
      action = `ajustou ×${prev} → ×${next}`;
      accentKey = 'sky';
    }
    return { display, name, action, accent: ACCENTS[accentKey] };
  }

  function describePack(log) {
    const p = log.pack || {};
    const total = (p.cost || 0) * (p.qty || 1);
    const sticks = (p.count || 0) * (p.qty || 1);
    const action = log.type === 'pack_added' ? 'registrou' : 'removeu';
    const accent = log.type === 'pack_added' ? ACCENTS.pitch : ACCENTS.flag;
    return { p, total, sticks, action, accent };
  }

  const filtered = $derived(() => {
    const q = query.trim().toLowerCase();
    return appState.logs.filter((log) => {
      if (filter === 'sticker' && log.type !== 'sticker') return false;
      if (filter === 'pack' && !log.type.startsWith('pack')) return false;
      if (!q) return true;
      if (log.type === 'sticker') {
        const s = lookup(log.code);
        const hay = `${log.code} ${s?.label || ''} ${s?.name || ''} ${s?.section || ''}`.toLowerCase();
        return hay.includes(q);
      }
      const p = log.pack || {};
      return `${p.source || ''} pacote`.toLowerCase().includes(q);
    });
  });

  const grouped = $derived(() => {
    const map = new Map();
    for (const log of filtered()) {
      const key = dayKey(log.ts);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    }
    return [...map.entries()].map(([day, items]) => ({ day, items }));
  });

  function handleClear() {
    if (confirm('Limpar todo o histórico de logs? Isso não apaga pacotes nem figurinhas.')) {
      clearLogs();
    }
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="Atividade recente · até 500 eventos" title="Logs">
    {#snippet right()}
      {#if appState.logs.length > 0}
        <button class="btn btn-ghost !py-2 !px-3 text-xs" onclick={handleClear} type="button">
          limpar
        </button>
      {/if}
    {/snippet}
  </Header>

  <div class="px-5">
    <div class="card p-4 grid grid-cols-3 gap-3">
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">total</div>
        <div class="num text-2xl text-white mt-1">{appState.logs.length}</div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">figurinhas</div>
        <div class="num text-2xl text-pitch-400 mt-1">
          {appState.logs.filter(l => l.type === 'sticker').length}
        </div>
      </div>
      <div>
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">pacotes</div>
        <div class="num text-2xl text-flag-400 mt-1">
          {appState.logs.filter(l => l.type.startsWith('pack')).length}
        </div>
      </div>
    </div>

    <div class="mt-4">
      <input
        bind:value={query}
        class="input"
        placeholder="Buscar nos logs (BRA1, mc, banca...)"
        type="search"
      />
    </div>

    <div class="mt-3 flex gap-2 overflow-x-auto scrollx -mx-5 px-5 pb-1">
      {#each [
        { id: 'all',     label: 'Tudo' },
        { id: 'sticker', label: 'Figurinhas' },
        { id: 'pack',    label: 'Pacotes' }
      ] as f}
        <button
          type="button"
          class="chip {filter === f.id ? 'chip-lime' : ''}"
          onclick={() => filter = f.id}
        >{f.label}</button>
      {/each}
    </div>
  </div>

  <div class="mt-4 px-5 space-y-5">
    {#if grouped().length === 0}
      <div class="card p-10 text-center text-ink-300">
        <div class="display text-lg text-white">Nenhum log ainda.</div>
        <div class="mt-1 text-sm">Marque figurinhas ou registre pacotes pra ver atividade aqui.</div>
      </div>
    {/if}

    {#each grouped() as g (g.day)}
      <section>
        <div class="flex items-end justify-between mb-2">
          <h2 class="display text-base font-semibold text-white capitalize">{g.day}</h2>
          <div class="text-[11px] text-ink-300 mono">{g.items.length} eventos</div>
        </div>
        <div class="card divide-y divide-white/5">
          {#each g.items as log (log.id)}
            {#if log.type === 'sticker'}
              {@const d = describeSticker(log)}
              <div class="flex items-center gap-3 p-3">
                <div class="h-10 w-10 grid place-items-center rounded-lg border mono text-[10px] {d.accent}">
                  {d.display}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-white truncate">
                    {d.action}
                    {#if d.name}<span class="text-ink-300 font-normal"> · {d.name}</span>{/if}
                  </div>
                  <div class="text-xs text-ink-300 mono">{fmtTime(log.ts)}</div>
                </div>
              </div>
            {:else}
              {@const d = describePack(log)}
              <div class="flex items-center gap-3 p-3">
                <div class="h-10 w-10 grid place-items-center rounded-xl border {d.accent}">
                  {#if log.type === 'pack_added'}
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4" stroke-linejoin="round"/></svg>
                  {:else}
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6" stroke-linecap="round"/></svg>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-white">
                    {d.action} {(d.p.qty || 1) > 1 ? `${d.p.qty}× ` : ''}pacote · <span class="text-lime-400">{fmt(d.total)}</span>
                  </div>
                  <div class="text-xs text-ink-300 flex items-center gap-1.5 flex-wrap">
                    <span class="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.12em] font-semibold text-ink-200">{d.p.source || 'mc'}</span>
                    <span>{fmtTime(log.ts)} · {d.sticks} figurinhas</span>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/each}
  </div>
</section>
