<script>
  import { totalStickers } from '../data/album.js';
  import {
    uniqueOwned, totalDuplicates, totalSpent, totalPacks,
    avgPackCost, avgStickerCost, completionPct, totalMissing, estimatedRemainingCost,
    uniqueSpecialOwned, totalSpecialStickers,
    teamProgressSummary, totalCommittedToGive, totalCommittedToReceive
  } from '../stores/derived.svelte.js';
  import { appState } from '../stores/appState.svelte.js';

  import Header from '../components/Header.svelte';
  import ProgressRing from '../components/ProgressRing.svelte';
  import StatCard from '../components/StatCard.svelte';
  import Trophy from '../components/Trophy.svelte';

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
</script>

<section class="screen-enter pb-32">
  <Header sub="Copa 2026" title="Meu álbum" hosts={true} />

  <!-- Hero tournament card -->
  <div class="px-5">
    <div class="card grain tricolor-bar p-5 pt-7 relative overflow-hidden">
      <!-- Numero 26 fantasma de fundo (clamp pra nao estourar em telas pequenas) -->
      <div class="ghost-26 pointer-events-none select-none"
           style="font-size: clamp(140px, 50vw, 220px); right: -8px; top: -16px;">26</div>

      <!-- Banner topo: trofeu + slogan + chips dos hosts -->
      <div class="relative z-10 flex items-start justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <Trophy size={40} />
          <div class="min-w-0">
            <div class="display text-[11px] tracking-[0.3em] text-gold-400 leading-none">SOMOS 26</div>
            <div class="text-[10px] uppercase tracking-[0.2em] text-ink-300 mt-1.5 truncate">48 seleções · 16 sedes</div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <span class="chip-host us"><span class="flag-mini flag-us"></span> USA</span>
          <span class="chip-host ca"><span class="flag-mini flag-ca"></span> CAN</span>
          <span class="chip-host mx"><span class="flag-mini flag-mx"></span> MEX</span>
        </div>
      </div>

      <!-- Ring central -->
      <div class="relative z-10 mt-5 flex flex-col items-center">
        <ProgressRing value={completionPct()} label="completo" sub={subtitle()} size={200} stroke={13} />
      </div>

      <!-- Mini-stats -->
      <div class="relative z-10 mt-5 grid grid-cols-3 gap-2">
        <div class="rounded-2xl bg-pitch-400/[0.08] border border-pitch-400/25 py-3 px-2 text-center">
          <div class="num text-xl text-white leading-none">{uniqueOwned()}<span class="text-ink-300 text-xs">/{totalStickers}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-pitch-400 mt-1">coladas</div>
        </div>
        <div class="rounded-2xl bg-gold-400/[0.10] border border-gold-400/30 py-3 px-2 text-center">
          <div class="num text-xl text-gold-400 leading-none">{uniqueSpecialOwned()}<span class="text-gold-400/80 text-xs">/{totalSpecialStickers()}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-gold-400 mt-1">douradas ★</div>
        </div>
        <div class="rounded-2xl bg-flag-400/[0.08] border border-flag-400/25 py-3 px-2 text-center">
          <div class="num text-xl text-flag-400 leading-none">{totalDuplicates()}</div>
          <div class="text-[10px] uppercase tracking-widest text-flag-400 mt-1">repetidas</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Faltam pra fechar: times mais perto (NOVA FEATURE) -->
  {#if closingSoon().length > 0}
    <div class="mt-4">
      <div class="px-5 flex items-end justify-between mb-2">
        <div>
          <div class="text-[10px] uppercase tracking-[0.22em] text-ink-300">Faltam pra fechar</div>
          <h2 class="display text-base font-semibold text-white leading-none mt-1">Times mais perto</h2>
        </div>
        <a href="#album" class="text-[11px] text-ink-300 underline">ver álbum</a>
      </div>
      <div class="scrollx flex gap-2 overflow-x-auto px-5 pb-1 -mr-5">
        {#each closingSoon() as t (t.team)}
          <a href={`#album`} class="shrink-0 w-[140px] rounded-2xl bg-white/[0.04] border border-white/10
                                    p-3 hover:bg-white/[0.07] transition tricolor-bar relative overflow-hidden">
            <div class="display text-xl font-bold text-white leading-none">{t.team}</div>
            <div class="text-[10px] text-ink-300 mt-1 truncate">{t.section}</div>
            <div class="mt-2 flex items-baseline gap-1">
              <span class="num text-2xl text-gold-400 leading-none">{t.missing}</span>
              <span class="text-[10px] uppercase tracking-wide text-ink-400">faltam</span>
            </div>
            <div class="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-pitch-400 to-gold-400"
                   style="width: {t.pct.toFixed(0)}%"></div>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Atalhos / Compromissos -->
  <div class="px-5 mt-4 grid grid-cols-2 gap-3">
    <a href="#packs" class="card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-flag-400/15 text-flag-400 border border-flag-400/30 shrink-0">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="min-w-0">
        <div class="font-semibold text-white truncate">Novo pacote</div>
        <div class="text-xs text-ink-300 truncate">Registrar abertura</div>
      </div>
    </a>
    <a href="#dups" class="card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition relative">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-gold-400/15 text-gold-400 border border-gold-400/30 shrink-0">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M8 8h11v11H8zM5 5h11v11H5z" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-white truncate">Repetidas</div>
        <div class="text-xs text-ink-300 truncate">{totalDuplicates()} disponíveis</div>
      </div>
      {#if openCommitments() > 0}
        <span class="chip !py-0 !px-2 !text-[10px] chip-coral">{openCommitments()}</span>
      {/if}
    </a>
  </div>

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
        <div class="text-[10px] uppercase tracking-[0.22em] text-ink-300">Calendário</div>
        <div class="text-sm font-semibold text-white truncate">11 de jun a 19 de jul de 2026</div>
        <div class="text-xs text-ink-300 truncate">104 partidas · final no MetLife</div>
      </div>
    </div>
  </div>
</section>
