<script>
  import { totalStickers } from '../data/album.js';
  import {
    uniqueOwned, totalDuplicates, totalSpent, totalPacks,
    avgPackCost, avgStickerCost, completionPct, totalMissing, estimatedRemainingCost,
    uniqueSpecialOwned, totalSpecialStickers,
    teamProgressSummary, totalCommittedToGive, totalCommittedToReceive,
    commitmentsByType, lookupSticker
  } from '../stores/derived.svelte.js';
  import { appState, fulfillExpect, fulfillGive } from '../stores/appState.svelte.js';
  import { daysRemaining, openRenewModal } from '../stores/authState.svelte.js';
  import { formatStickerLabel } from '../utils/format.js';
  import { isNative } from '../utils/ocr.js';

  import ProgressRing from '../components/ProgressRing.svelte';
  import StatCard from '../components/StatCard.svelte';

  const showScanShortcut = isNative();

  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = (n) => `${appState.settings.currency} ${fmt.format(n || 0)}`;
  const cur1 = (n) => `${appState.settings.currency} ${(n || 0).toFixed(2).replace('.', ',')}`;

  const subtitle = $derived(() => {
    const m = totalMissing();
    if (m === 0 && uniqueOwned() === totalStickers) return 'Álbum completo — campeão!';
    if (m === totalStickers) return 'Vamos abrir o primeiro pacote?';
    return `Faltam ${m} pra fechar o álbum`;
  });

  // Top 6 times mais perto de fechar (faltando entre 1 e 5 figurinhas)
  const closingSoon = $derived(() => teamProgressSummary().slice(0, 8));

  const openCommitments = $derived(() => totalCommittedToGive() + totalCommittedToReceive());
  const expectingPreview = $derived(() => commitmentsByType('expect').slice(0, 3));
  const givingPreview = $derived(() => commitmentsByType('give').slice(0, 3));

  // ultima atividade (3 mais recentes que sao tap/scan/pack)
  const recentLogs = $derived(() => appState.logs.slice(0, 4));

  function logSummary(log) {
    if (log.type === 'pack_added') return `+1 pacote ${log.pack?.source || ''}`;
    if (log.type === 'pack_removed') return 'pacote removido';
    if (log.type === 'sticker') {
      const s = lookupSticker(log.code);
      const label = s ? formatStickerLabel(s) : log.code;
      if (log.next === 0) return `${label} zerada`;
      if (log.prev === 0) return `${label} marcada`;
      return `${label} → ×${log.next}`;
    }
    if (log.type === 'commitment_added') {
      const c = log.commitment;
      const s = c ? lookupSticker(c.code) : null;
      const label = s ? formatStickerLabel(s) : c?.code;
      return c?.type === 'give'
        ? `prometi ${label} pra ${c.person}`
        : `${c?.person} prometeu ${label}`;
    }
    if (log.type === 'commitment_fulfilled') {
      const c = log.commitment;
      const s = c ? lookupSticker(c.code) : null;
      const label = s ? formatStickerLabel(s) : c?.code;
      return c?.type === 'give' ? `entreguei ${label}` : `recebi ${label}`;
    }
    return log.type;
  }

  function logTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }
</script>

<section class="screen-enter pb-32">
  {#if daysRemaining() > 0 && daysRemaining() <= 7}
    <div class="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2">
      <div class="flex-1 text-xs leading-tight text-ink-200">
        <strong class="text-gold-400">{daysRemaining()} {daysRemaining() === 1 ? 'dia' : 'dias'} restantes</strong>
        <div class="text-ink-300">Renove antes que expire pra não perder o scan.</div>
      </div>
      <button type="button" onclick={openRenewModal}
              class="rounded-lg bg-gold-500 px-3 py-1.5 text-xs font-medium text-[#050b1f] active:scale-[0.98]">
        renovar
      </button>
    </div>
  {/if}

  <!-- Header sport-tv: wordmark FIGS + tagline curta + tricolor stripe -->
  <header class="px-5 pt-[max(1rem,calc(var(--safe-top)+0.5rem))] pb-3">
    <div class="flex items-baseline justify-between gap-3">
      <div class="flex items-baseline gap-2 min-w-0">
        <h1 class="display text-4xl font-bold leading-none">
          <span class="bg-gradient-to-b from-gold-400 to-gold-600 bg-clip-text text-transparent">FIGS</span>
        </h1>
        <span class="text-[10px] uppercase tracking-[0.14em] text-ink-400">copa 2026</span>
      </div>
      <span class="num text-[11px] text-ink-300">{completionPct().toFixed(1).replace('.', ',')}%</span>
    </div>
    <div class="mt-2 h-[3px] w-full rounded-full overflow-hidden flex">
      <div class="bg-sky26-500" style="width: 33%"></div>
      <div class="bg-flag-500"  style="width: 33%"></div>
      <div class="bg-pitch-500" style="width: 34%"></div>
    </div>
  </header>

  <!-- Hero broadcast: ring central + 3 stats em strip -->
  <div class="px-5">
    <div class="card p-5 relative overflow-hidden">
      <div class="flex flex-col items-center">
        <ProgressRing value={completionPct()} label="do álbum" sub={subtitle()} size={200} stroke={13} />
      </div>

      <div class="mt-5 grid grid-cols-3 gap-2">
        <div class="rounded-2xl bg-pitch-400/[0.08] border border-pitch-400/25 py-3 px-2 text-center">
          <div class="num text-xl text-white leading-none">{uniqueOwned()}<span class="text-ink-300 text-xs">/{totalStickers}</span></div>
          <div class="text-[10px] uppercase tracking-wider text-pitch-400 mt-1">coladas</div>
        </div>
        <div class="rounded-2xl bg-gold-400/[0.10] border border-gold-400/30 py-3 px-2 text-center">
          <div class="num text-xl text-gold-400 leading-none">{uniqueSpecialOwned()}<span class="text-gold-400/80 text-xs">/{totalSpecialStickers()}</span></div>
          <div class="text-[10px] uppercase tracking-wider text-gold-400 mt-1">douradas</div>
        </div>
        <div class="rounded-2xl bg-flag-400/[0.08] border border-flag-400/25 py-3 px-2 text-center">
          <div class="num text-xl text-flag-400 leading-none">{totalDuplicates()}</div>
          <div class="text-[10px] uppercase tracking-wider text-flag-400 mt-1">repetidas</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Seleções que faltam menos (próximas de fechar) -->
  {#if closingSoon().length > 0}
    <div class="mt-5">
      <div class="px-5 flex items-end justify-between gap-2 mb-2 min-w-0">
        <h2 class="display text-base font-semibold text-white leading-none truncate flex-1 min-w-0">
          Seleções que faltam menos
        </h2>
        <a href="#album" class="text-[11px] text-ink-300 underline shrink-0">ver álbum</a>
      </div>
      <div class="scrollx flex gap-2 overflow-x-auto px-5 pb-2 -mr-0">
        {#each closingSoon() as t (t.team)}
          <a href={`#album`}
             class="shrink-0 w-[120px] rounded-2xl bg-white/[0.04] border border-white/10
                    p-3 hover:bg-white/[0.07] transition flex flex-col">
            <!-- Header: codigo + nome -->
            <div class="display text-2xl font-bold text-white leading-none">{t.team}</div>
            <div class="text-[10px] text-ink-400 mt-0.5 truncate">{t.section}</div>

            <!-- Big number central -->
            <div class="mt-3 flex items-baseline gap-1">
              <span class="num text-3xl text-gold-400 leading-none">{t.missing}</span>
              <span class="text-[10px] uppercase tracking-wide text-ink-400">restam</span>
            </div>

            <!-- Progress bar fina -->
            <div class="mt-2 h-[3px] rounded-full bg-white/10 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-pitch-400 to-gold-400"
                   style="width: {t.pct.toFixed(0)}%"></div>
            </div>
            <div class="text-[9px] text-ink-400 mt-1 mono">{t.pct.toFixed(0)}% colado</div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Atalhos: Scan (so no app nativo) + Pacote + Repetidas -->
  <div class="px-5 mt-4 grid {showScanShortcut ? 'grid-cols-3' : 'grid-cols-2'} gap-2">
    {#if showScanShortcut}
      <a href="#scan" class="card p-3 flex flex-col items-center gap-1 hover:bg-white/[0.06] transition text-center">
        <div class="h-9 w-9 grid place-items-center rounded-xl bg-gold-400/15 text-gold-400 border border-gold-400/30">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 7h3l2-2h8l2 2h3v12H3z" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="13" r="3.5"/>
          </svg>
        </div>
        <div class="text-[11px] font-semibold text-white">Scan</div>
        <div class="text-[10px] text-ink-400">foto → ação</div>
      </a>
    {/if}
    <a href="#packs" class="card p-3 flex flex-col items-center gap-1 hover:bg-white/[0.06] transition text-center">
      <div class="h-9 w-9 grid place-items-center rounded-xl bg-flag-400/15 text-flag-400 border border-flag-400/30">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="text-[11px] font-semibold text-white">Pacote</div>
      <div class="text-[10px] text-ink-400">registrar</div>
    </a>
    <a href="#dups" class="card p-3 flex flex-col items-center gap-1 hover:bg-white/[0.06] transition text-center relative">
      <div class="h-9 w-9 grid place-items-center rounded-xl bg-pitch-400/15 text-pitch-400 border border-pitch-400/30">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M8 8h11v11H8zM5 5h11v11H5z" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="text-[11px] font-semibold text-white">Trocar</div>
      <div class="text-[10px] text-ink-400">{totalDuplicates()} repet.</div>
      {#if openCommitments() > 0}
        <span class="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-flag-500 text-[9px] text-white grid place-items-center font-bold border border-ink-950">
          {openCommitments()}
        </span>
      {/if}
    </a>
  </div>

  <!-- Compromissos abertos -->
  {#if openCommitments() > 0}
    <div class="px-5 mt-4">
      <div class="flex items-end justify-between mb-2">
        <div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">Compromissos</div>
          <h2 class="display text-base font-semibold text-white leading-none mt-1">Em aberto</h2>
        </div>
        <a href="#dups" class="text-[11px] text-ink-300 underline">ver todos</a>
      </div>
      <div class="space-y-2">
        {#if expectingPreview().length > 0}
          <div class="card p-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-pitch-400 mb-1.5">
              esperando receber · {commitmentsByType('expect').length}
            </div>
            <div class="space-y-1">
              {#each expectingPreview() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 py-1">
                  <div class="mono text-[11px] text-pitch-400 min-w-[60px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
                  <div class="flex-1 text-xs text-ink-200 truncate">de {c.person}</div>
                  <button class="btn btn-ghost !py-1 !px-2 text-[10px]" onclick={() => fulfillExpect(c.id)} type="button">recebi</button>
                </div>
              {/each}
              {#if commitmentsByType('expect').length > 3}
                <a href="#dups" class="block text-[11px] text-ink-300 text-center pt-1">+ {commitmentsByType('expect').length - 3} mais</a>
              {/if}
            </div>
          </div>
        {/if}
        {#if givingPreview().length > 0}
          <div class="card p-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-flag-400 mb-1.5">
              prometidas pra entregar · {commitmentsByType('give').length}
            </div>
            <div class="space-y-1">
              {#each givingPreview() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 py-1">
                  <div class="mono text-[11px] text-flag-400 min-w-[60px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
                  <div class="flex-1 text-xs text-ink-200 truncate">pra {c.person}</div>
                  <button class="btn btn-ghost !py-1 !px-2 text-[10px]" onclick={() => fulfillGive(c.id)} type="button">entreguei</button>
                </div>
              {/each}
              {#if commitmentsByType('give').length > 3}
                <a href="#dups" class="block text-[11px] text-ink-300 text-center pt-1">+ {commitmentsByType('give').length - 3} mais</a>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Atividade recente -->
  {#if recentLogs().length > 0}
    <div class="px-5 mt-4">
      <div class="flex items-end justify-between mb-2">
        <div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">Atividade</div>
          <h2 class="display text-base font-semibold text-white leading-none mt-1">Recente</h2>
        </div>
        <a href="#logs" class="text-[11px] text-ink-300 underline">ver tudo</a>
      </div>
      <div class="card divide-y divide-white/5">
        {#each recentLogs() as log (log.id)}
          <div class="flex items-center gap-2 p-2.5">
            <div class="text-xs text-ink-200 flex-1 truncate">{logSummary(log)}</div>
            <span class="text-[10px] text-ink-400 mono shrink-0">{logTime(log.ts)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Money grid -->
  <div class="px-5 mt-4 grid grid-cols-2 gap-3">
    <StatCard
      label="gasto total"
      value={cur(totalSpent())}
      sub={`em ${totalPacks()} pacote${totalPacks() === 1 ? '' : 's'}`}
      accent="flag"
    />
    <StatCard
      label="por pacote"
      value={cur1(avgPackCost())}
      sub="média"
      accent="gold"
    />
    <StatCard
      label="por figurinha"
      value={cur1(avgStickerCost())}
      sub="custo unitário"
      accent="sky"
    />
    <StatCard
      label="estimativa"
      value={cur(estimatedRemainingCost())}
      sub="pra erguer a taça"
      accent="pitch"
    />
  </div>

  <!-- Tournament fact strip -->
  <div class="px-5 mt-4">
    <div class="card p-4 flex items-center gap-3">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-sky26-500 via-flag-500 to-pitch-500 shadow-glow shrink-0">
        <svg viewBox="0 0 24 24" class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 2v20M2 12h20M5 5l14 14M5 19L19 5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">Calendário</div>
        <div class="text-sm font-semibold text-white truncate">11 de jun a 19 de jul de 2026</div>
        <div class="text-xs text-ink-300 truncate">104 partidas · final no MetLife</div>
      </div>
    </div>
  </div>
</section>
