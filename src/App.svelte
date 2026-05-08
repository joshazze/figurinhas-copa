<script>
  import BottomNav from './lib/components/BottomNav.svelte';
  import Home from './lib/pages/Home.svelte';
  import Album from './lib/pages/Album.svelte';
  import Duplicates from './lib/pages/Duplicates.svelte';
  import Packs from './lib/pages/Packs.svelte';
  import Logs from './lib/pages/Logs.svelte';
  import Settings from './lib/pages/Settings.svelte';

  let tab = $state(readHash());

  function readHash() {
    const h = (location.hash || '').replace('#', '');
    return ['home','album','dups','packs','logs','settings'].includes(h) ? h : 'home';
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

<main class="mx-auto max-w-md min-h-dvh">
  {#if tab === 'home'}     <Home />
  {:else if tab === 'album'} <Album />
  {:else if tab === 'dups'}  <Duplicates />
  {:else if tab === 'packs'} <Packs />
  {:else if tab === 'logs'}  <Logs />
  {:else if tab === 'settings'} <Settings />
  {/if}
</main>

<BottomNav current={tab} onChange={go} />
