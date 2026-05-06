<script>
  import { totalStickers } from '../data/album.js';
  import {
    uniqueOwned, totalDuplicates, totalSpent, totalPacks,
    avgPackCost, avgStickerCost, completionPct, totalMissing, estimatedRemainingCost,
    uniqueSpecialOwned, totalSpecialStickers
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
    if (m === 0 && uniqueOwned() === totalStickers) return 'Álbum completo — você é campeão!';
    if (m === totalStickers) return 'Vamos abrir o primeiro pacote?';
    return `Faltam ${m} pra fechar o álbum`;
  });
</script>

<section class="screen-enter pb-32">
  <Header sub="FIFA World Cup 2026 · 🇺🇸 🇨🇦 🇲🇽" title="Meu álbum" />

  <!-- Hero tournament card -->
  <div class="px-5">
    <div class="card grain tricolor-bar p-5 pt-7 flex flex-col items-center text-center relative">
      <!-- Número 26 fantasma de fundo -->
      <div class="ghost-26 text-[260px] -right-6 -top-6">26</div>

      <!-- Banner topo: troféu + slogan -->
      <div class="relative z-10 flex items-center gap-3 mb-1">
        <Trophy size={44} />
        <div class="text-left">
          <div class="display text-[11px] tracking-[0.3em] text-gold-400 leading-none">SOMOS 26</div>
          <div class="text-[10px] uppercase tracking-[0.22em] text-ink-300 mt-1">48 seleções · 16 sedes</div>
        </div>
      </div>

      <!-- Hosts row -->
      <div class="relative z-10 mt-3 flex items-center gap-1.5">
        <span class="chip-host us"><span class="flag-mini flag-us"></span> USA</span>
        <span class="chip-host ca"><span class="flag-mini flag-ca"></span> Canadá</span>
        <span class="chip-host mx"><span class="flag-mini flag-mx"></span> México</span>
      </div>

      <div class="relative z-10 mt-5">
        <ProgressRing value={completionPct()} label="completo" sub={subtitle()} />
      </div>

      <div class="relative z-10 mt-5 grid grid-cols-3 gap-2 w-full">
        <div class="rounded-2xl bg-pitch-400/[0.08] border border-pitch-400/25 py-3">
          <div class="num text-xl text-white">{uniqueOwned()}<span class="text-ink-300 text-sm">/{totalStickers}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-pitch-400 mt-0.5">coladas</div>
        </div>
        <div class="rounded-2xl bg-gold-400/[0.10] border border-gold-400/30 py-3">
          <div class="num text-xl text-gold-400">{uniqueSpecialOwned()}<span class="text-gold-400/80 text-sm">/{totalSpecialStickers()}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-gold-400 mt-0.5">douradas ★</div>
        </div>
        <div class="rounded-2xl bg-flag-400/[0.08] border border-flag-400/25 py-3">
          <div class="num text-xl text-flag-400">{totalDuplicates()}</div>
          <div class="text-[10px] uppercase tracking-widest text-flag-400 mt-0.5">repetidas</div>
        </div>
      </div>
    </div>
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

  <!-- Atalhos -->
  <div class="px-5 mt-4 grid grid-cols-2 gap-3">
    <a href="#packs" class="card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-flag-400/15 text-flag-400 border border-flag-400/30">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <div class="font-semibold text-white">Novo pacote</div>
        <div class="text-xs text-ink-300">Registrar abertura</div>
      </div>
    </a>
    <a href="#dups" class="card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-gold-400/15 text-gold-400 border border-gold-400/30">
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M8 8h11v11H8zM5 5h11v11H5z" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="font-semibold text-white">Trocar repetidas</div>
        <div class="text-xs text-ink-300">{totalDuplicates()} disponíveis</div>
      </div>
    </a>
  </div>

  <!-- Tournament fact strip -->
  <div class="px-5 mt-4">
    <div class="card p-4 flex items-center gap-3">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-sky26-500 via-flag-500 to-pitch-500 shadow-glow">
        <svg viewBox="0 0 24 24" class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 2v20M2 12h20M5 5l14 14M5 19L19 5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-[10px] uppercase tracking-[0.22em] text-ink-300">Calendário</div>
        <div class="text-sm font-semibold text-white truncate">11 de jun a 19 de jul de 2026</div>
        <div class="text-xs text-ink-300">104 partidas · final no MetLife Stadium</div>
      </div>
    </div>
  </div>
</section>
