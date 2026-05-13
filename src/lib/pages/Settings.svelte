<script>
  import { appState, exportJSON, importJSON, resetAll, updateSettings } from '../stores/appState.svelte.js';
  import { auth, daysRemaining, isAuthenticated, clearAuth, openRenewModal } from '../stores/authState.svelte.js';
  import { changePassword } from '../api/auth.js';
  import { ApiError } from '../api/client.js';
  import Header from '../components/Header.svelte';

  let importErr = $state('');
  let confirmReset = $state(false);

  let showPwdForm = $state(false);
  let oldPwd = $state('');
  let newPwd = $state('');
  let pwdErr = $state('');
  let pwdOk = $state('');
  let pwdLoading = $state(false);

  async function submitChangePwd(e) {
    e.preventDefault();
    if (pwdLoading) return;
    pwdErr = '';
    pwdOk = '';
    pwdLoading = true;
    try {
      await changePassword({ oldPassword: oldPwd, newPassword: newPwd });
      pwdOk = 'Senha trocada.';
      oldPwd = '';
      newPwd = '';
      setTimeout(() => { showPwdForm = false; pwdOk = ''; }, 1500);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'invalid_credentials') pwdErr = 'Senha atual incorreta.';
      else if (code === 'same_password') pwdErr = 'Nova senha igual à atual.';
      else pwdErr = err.message || 'Erro ao trocar senha.';
    } finally {
      pwdLoading = false;
    }
  }

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
            {#if auth.email}
              <div class="text-[10px] text-ink-400 mt-1 truncate">{auth.email}</div>
            {/if}
          </div>
          <div class="text-right">
            <div class="num text-2xl text-white">{days}</div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-ink-400">
              {days === 1 ? 'dia' : 'dias'} restante{days === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <button type="button" onclick={openRenewModal}
                  class="text-gold-400 underline">renovar</button>
          <button type="button" onclick={() => { showPwdForm = !showPwdForm; pwdErr = ''; pwdOk = ''; }}
                  class="text-ink-300 underline">trocar senha</button>
          <button type="button" onclick={clearAuth}
                  class="text-ink-400 underline">sair desse aparelho</button>
        </div>

        {#if showPwdForm}
          <form onsubmit={submitChangePwd} class="mt-3 space-y-2">
            <input
              type="password"
              autocomplete="current-password"
              placeholder="senha atual"
              bind:value={oldPwd}
              class="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
            />
            <input
              type="password"
              autocomplete="new-password"
              placeholder="nova senha (mín. 6)"
              bind:value={newPwd}
              class="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
            />
            {#if pwdErr}<p class="text-[11px] text-flag">{pwdErr}</p>{/if}
            {#if pwdOk}<p class="text-[11px] text-pitch-400">{pwdOk}</p>{/if}
            <button
              type="submit"
              disabled={pwdLoading || oldPwd.length < 1 || newPwd.length < 6}
              class="w-full rounded-lg bg-gold py-2 text-sm font-medium text-[#050b1f] transition disabled:opacity-50"
            >{pwdLoading ? 'Salvando...' : 'Salvar'}</button>
          </form>
        {/if}
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
