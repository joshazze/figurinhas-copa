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
  <!-- Splash uses inline colors so it renders even if a stale SW serves an old CSS bundle. -->
  <div style="position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:#050b1f;padding:0 24px;">
    <div style="text-align:center;">
      <div style="font-size:2.25rem;font-weight:700;letter-spacing:0.04em;color:#fbbf24;font-family:'Bebas Neue',system-ui,sans-serif;">FIGS</div>
      {#if syncStatus.bootError}
        <p style="margin-top:24px;font-size:14px;color:#ef4444;">Sem conexão com o servidor.</p>
        <p style="margin-top:4px;font-size:12px;color:#9aa6cf;">{syncStatus.bootError}</p>
        <button type="button" onclick={retryBoot}
                style="margin-top:24px;background:#fbbf24;color:#050b1f;border:0;border-radius:12px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer;">
          tentar de novo
        </button>
        <p style="margin-top:32px;font-size:11px;color:#7886b8;line-height:1.5;">
          Se persistir, abra <span style="color:#dde3f2;">joshazze.github.io/figurinhas-copa/recover.html</span> no Safari.
        </p>
      {:else}
        <p style="margin-top:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#c1c9e3;">carregando seu álbum...</p>
        <div style="margin:24px auto 0;height:4px;width:128px;background:rgba(255,255,255,0.1);border-radius:9999px;overflow:hidden;">
          <div style="height:100%;width:50%;background:#fbbf24;animation:pulse 1.5s ease-in-out infinite;"></div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes pulse { 0%,100% { opacity:0.4; transform:translateX(0); } 50% { opacity:1; transform:translateX(80%); } }
</style>

<ActivationGate />
<RenewModal />
