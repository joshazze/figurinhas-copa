<script>
  import { onMount } from 'svelte';
  import BottomNav from './lib/components/BottomNav.svelte';
  import ActivationGate from './lib/components/ActivationGate.svelte';
  import RenewModal from './lib/components/RenewModal.svelte';
  import Home from './lib/pages/Home.svelte';
  import Album from './lib/pages/Album.svelte';
  import Duplicates from './lib/pages/Duplicates.svelte';
  import Scan from './lib/pages/Scan.svelte';
  import Packs from './lib/pages/Packs.svelte';
  import Logs from './lib/pages/Logs.svelte';
  import Settings from './lib/pages/Settings.svelte';
  import { pullOnBoot, setupAutoSync, syncStatus } from './lib/api/sync.js';
  import { hasScan, isAuthenticated } from './lib/stores/authState.svelte.js';

  let tab = $state(readHash());

  // Anyone landing on #scan without a Pro tier is redirected to home.
  // (Gate covers the screen too, but this prevents the URL from sticking.)
  $effect(() => {
    if (tab === 'scan' && !hasScan()) {
      tab = 'home';
      history.replaceState(null, '', '#home');
    }
  });

  onMount(async () => {
    setupAutoSync();
    if (isAuthenticated()) await pullOnBoot();
  });

  // Re-pull whenever the user authenticates (signup / login / renew).
  $effect(() => {
    if (isAuthenticated() && !syncStatus.bootReady) {
      pullOnBoot();
    }
  });

  async function retryBoot() {
    await pullOnBoot();
  }

  function readHash() {
    const h = (location.hash || '').replace('#', '');
    return ['home','album','dups','scan','packs','logs','settings'].includes(h) ? h : 'home';
  }

  function go(t) {
    tab = t;
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => tab = readHash());
  }
</script>

{#if isAuthenticated() && syncStatus.bootReady}
  <main class="mx-auto max-w-md min-h-dvh">
    {#if tab === 'home'}     <Home />
    {:else if tab === 'album'} <Album />
    {:else if tab === 'dups'}  <Duplicates />
    {:else if tab === 'scan'}  <Scan />
    {:else if tab === 'packs'} <Packs />
    {:else if tab === 'logs'}  <Logs />
    {:else if tab === 'settings'} <Settings />
    {/if}
  </main>

  <BottomNav current={tab} onChange={go} />
{:else if isAuthenticated() && !syncStatus.bootReady}
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-[#050b1f] px-6">
    <div class="text-center">
      <div class="mb-3 text-4xl font-display tracking-wide text-gold">FIGS</div>
      {#if syncStatus.bootError}
        <p class="mt-6 text-sm text-flag">Sem conexão com o servidor.</p>
        <p class="mt-1 text-xs text-ink-400">{syncStatus.bootError}</p>
        <button type="button" onclick={retryBoot}
                class="mt-6 rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-[#050b1f]">
          tentar de novo
        </button>
      {:else}
        <p class="mt-2 text-xs uppercase tracking-[0.3em] text-ink-300">carregando seu álbum...</p>
        <div class="mt-6 mx-auto h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div class="h-full w-1/2 animate-pulse-slide bg-gold"></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<ActivationGate />
<RenewModal />
