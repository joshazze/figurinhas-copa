<script>
  import { appState, exportJSON, importJSON, resetAll, updateSettings } from '../stores/appState.svelte.js';
  import { auth, daysRemaining, isAuthenticated, clearAuth } from '../stores/authState.svelte.js';
  import Header from '../components/Header.svelte';

  let importErr = $state('');
  let confirmReset = $state(false);

  function downloadBackup() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `figurinhas-copa-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        importJSON(text);
        importErr = '';
      } catch (e) {
        importErr = 'Arquivo inválido';
      }
    };
    input.click();
  }

  function doReset() {
    if (!confirmReset) { confirmReset = true; return; }
    resetAll();
    confirmReset = false;
  }
</script>

<section class="screen-enter pb-32">
  <Header sub="Backup e preferências" title="Ajustes" hosts={false} />

  <div class="px-5 space-y-3">
    {#if isAuthenticated()}
      {@const days = daysRemaining()}
      {@const isPro = auth.tier === 'pro'}
      <div class="card p-4">
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">plano</div>
        <div class="mt-2 flex items-center justify-between">
          <div>
            <div class="display text-xl font-bold {isPro ? 'text-gold-400' : 'text-pitch-400'}">
              {isPro ? 'Pro' : 'Lite'}
            </div>
            <div class="text-[11px] text-ink-300 mt-0.5">
              {isPro ? 'Catálogo + sync + scan automático' : 'Catálogo + sync (sem scan)'}
            </div>
          </div>
          <div class="text-right">
            <div class="num text-2xl text-white">{days}</div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {days === 1 ? 'dia' : 'dias'} restante{days === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <button type="button" onclick={clearAuth}
                class="mt-3 text-[11px] text-ink-400 underline">sair (revogar acesso neste aparelho)</button>
      </div>
    {/if}

    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">moeda</div>
      <div class="mt-2 grid grid-cols-3 gap-2">
        {#each ['R$','US$','€'] as c}
          <button
            type="button"
            class="rounded-xl py-2 text-sm font-semibold border transition
              {appState.settings.currency === c
                ? 'bg-gradient-to-r from-flag-500 to-flag-400 text-white border-flag-500'
                : 'bg-white/5 border-white/10 text-ink-200'}"
            onclick={() => updateSettings({ currency: c })}
          >{c}</button>
        {/each}
      </div>
    </div>

    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">backup</div>
      <p class="text-xs text-ink-300 mt-1">
        Salve um JSON com seu álbum e gastos. Importe em qualquer dispositivo.
      </p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button class="btn btn-ghost" type="button" onclick={downloadBackup}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9m0 0L8 13m4-4l4 4M5 3h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
          exportar
        </button>
        <button class="btn btn-ghost" type="button" onclick={pickFile}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke-linecap="round" stroke-linejoin="round"/></svg>
          importar
        </button>
      </div>
      {#if importErr}
        <div class="mt-2 text-xs text-coral-400">{importErr}</div>
      {/if}
    </div>

    <div class="card p-4">
      <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">zona de risco</div>
      <p class="text-xs text-ink-300 mt-1">
        Apaga todas as figurinhas e pacotes registrados. Sem volta.
      </p>
      <button
        class="btn w-full mt-3 {confirmReset ? 'bg-coral-500 text-white' : 'btn-ghost'}"
        type="button"
        onclick={doReset}
      >
        {confirmReset ? 'Toque de novo para confirmar' : 'Resetar tudo'}
      </button>
    </div>

    <div class="text-center text-[11px] text-ink-400 pt-4 space-y-1">
      <div class="flex items-center justify-center gap-1.5">
        <span class="flag-mini flag-us"></span>
        <span class="flag-mini flag-ca"></span>
        <span class="flag-mini flag-mx"></span>
      </div>
      <div class="display tracking-[0.3em] text-ink-300">FIFA WORLD CUP 2026</div>
      <div>Figs · Cromos da Copa 2026 · funciona offline</div>
    </div>
  </div>
</section>
