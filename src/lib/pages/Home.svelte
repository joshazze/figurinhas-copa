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

  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = (n) => `${appState.settings.currency} ${fmt.format(n || 0)}`;
  const cur1 = (n) => `${appState.settings.currency} ${(n || 0).toFixed(2).replace('.', ',')}`;

  const subtitle = $derived(() => {
    const m = totalMissing();
    if (m === 0 && uniqueOwned() === totalStickers) return 'Álbum completo!';
    if (m === totalStickers) return 'Vamos abrir o primeiro pacote?';
    return `Faltam ${m} figurinhas`;
  });
</script>

<section class="screen-enter pb-32">
  <Header sub="Copa 2026" title="Meu álbum" />

  <!-- Hero progress -->
  <div class="px-5">
    <div class="card grain p-5 flex flex-col items-center text-center">
      <div class="flex items-center gap-2 chip chip-lime">
        <span class="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
        ao vivo
      </div>

      <div class="mt-4">
        <ProgressRing value={completionPct()} label="completo" sub={subtitle()} />
      </div>

      <div class="mt-5 grid grid-cols-3 gap-2 w-full">
        <div class="rounded-2xl bg-white/[0.04] border border-white/10 py-3">
          <div class="num text-xl text-white">{uniqueOwned()}<span class="text-ink-300 text-sm">/{totalStickers}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-ink-300 mt-0.5">coladas</div>
        </div>
        <div class="rounded-2xl bg-sun-400/[0.08] border border-sun-400/30 py-3">
          <div class="num text-xl text-sun-400">{uniqueSpecialOwned()}<span class="text-sun-400/80 text-sm">/{totalSpecialStickers()}</span></div>
          <div class="text-[10px] uppercase tracking-widest text-sun-400 mt-0.5">especiais ★</div>
        </div>
        <div class="rounded-2xl bg-white/[0.04] border border-white/10 py-3">
          <div class="num text-xl text-coral-400">{totalDuplicates()}</div>
          <div class="text-[10px] uppercase tracking-widest text-ink-300 mt-0.5">repetidas</div>
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
      accent="lime"
    />
    <StatCard
      label="por pacote"
      value={cur1(avgPackCost())}
      sub="média"
      accent="sun"
    />
    <StatCard
      label="por figurinha"
      value={cur1(avgStickerCost())}
      sub="taxa de economia"
      accent="ink"
    />
    <StatCard
      label="estimativa"
      value={cur(estimatedRemainingCost())}
      sub="pra fechar o álbum"
      accent="coral"
    />
  </div>

  <!-- Atalhos -->
  <div class="px-5 mt-4 grid grid-cols-2 gap-3">
    <a href="#packs" class="card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition">
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-lime-400/15 text-lime-400 border border-lime-400/30">
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
      <div class="h-10 w-10 grid place-items-center rounded-xl bg-sun-400/15 text-sun-400 border border-sun-400/30">
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
</section>
