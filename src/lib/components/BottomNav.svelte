<script>
  let { current = 'home', onChange = () => {} } = $props();

  const tabs = [
    { id: 'home',    label: 'Início',    icon: 'M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3z' },
    { id: 'album',   label: 'Álbum',     icon: 'M4 4h16v16H4zM4 9h16M9 4v16' },
    { id: 'dups',    label: 'Repetidas', icon: 'M8 8h11v11H8zM5 5h11v11H5z' },
    { id: 'packs',   label: 'Pacotes',   icon: 'M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4' },
    { id: 'settings',label: 'Ajustes',   icon: 'M12 8a4 4 0 100 8 4 4 0 000-8zM2 12h2m16 0h2M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }
  ];
</script>

<nav class="fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.6rem,var(--safe-bottom))] pt-2
            bg-gradient-to-t from-ink-950 via-ink-950/90 to-transparent">
  <div class="card mx-auto max-w-md flex items-stretch p-1.5">
    {#each tabs as t}
      <button
        type="button"
        class="tab-btn {current === t.id ? 'active' : ''}"
        onclick={() => onChange(t.id)}
      >
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round" stroke-linejoin="round">
          <path d={t.icon} />
        </svg>
        <span>{t.label}</span>
      </button>
    {/each}
  </div>
</nav>
