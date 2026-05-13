<script>
  import { renew } from '../api/auth.js';
  import { ApiError } from '../api/client.js';
  import { auth, renewModal, closeRenewModal } from '../stores/authState.svelte.js';

  let password = $state('');
  let code = $state('');
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  const ERROR_MESSAGES = {
    invalid_code: 'Código inválido.',
    code_not_found: 'Esse código não foi emitido por nós.',
    code_revoked: 'Esse código foi revogado.',
    code_already_used: 'Esse código já foi usado.',
    invalid_credentials: 'Senha incorreta.',
    network: 'Sem internet ou servidor fora do ar.',
  };

  function formatCode(value) {
    const raw = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (!raw) return '';
    return raw.replace(/^(FIGS)(.{0,4})(.{0,4})(.{0,4})(.{0,4}).*/, (_, a, b, c, d, e) => {
      return [a, b, c, d, e].filter(Boolean).join('-');
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (loading || !auth.email) return;
    error = '';
    loading = true;
    try {
      await renew({ email: auth.email, password, code });
      success = true;
      setTimeout(close, 1500);
    } catch (err) {
      const key = err instanceof ApiError ? err.code : 'network';
      error = ERROR_MESSAGES[key] || (err.message || 'Erro inesperado.');
    } finally {
      loading = false;
    }
  }

  function close() {
    password = '';
    code = '';
    error = '';
    success = false;
    closeRenewModal();
  }

  function canSubmit() {
    if (password.length < 1) return false;
    if (code.replace(/[^A-Z0-9]/g, '').length < 20) return false;
    return true;
  }
</script>

{#if renewModal.open}
  <div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center"
       onclick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="w-full max-w-sm rounded-t-2xl bg-[#0a1230] p-6 sm:rounded-2xl">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-medium text-ink-100">Renovar assinatura</h2>
          <p class="mt-1 text-xs text-ink-300">{auth.email}</p>
        </div>
        <button type="button" onclick={close}
                class="text-xs uppercase tracking-wider text-ink-400 hover:text-ink-200">fechar</button>
      </div>

      {#if success}
        <p class="mt-6 rounded-lg bg-pitch-500/20 p-3 text-center text-sm text-pitch-400">
          Renovado por mais 30 dias.
        </p>
      {:else}
        <form onsubmit={submit} class="mt-5 space-y-3">
          <input
            type="password"
            autocomplete="current-password"
            placeholder="Sua senha"
            bind:value={password}
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
          <input
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="FIGS-XXXX-XXXX-XXXX-XXXX"
            value={code}
            oninput={(e) => (code = formatCode(e.currentTarget.value))}
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 font-mono text-base tracking-wider text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
          />
          {#if error}<p class="text-sm text-flag">{error}</p>{/if}
          <button
            type="submit"
            disabled={loading || !canSubmit()}
            class="w-full rounded-xl bg-gold py-3 font-medium text-[#050b1f] transition disabled:opacity-50"
          >{loading ? 'Renovando...' : 'Renovar 30 dias'}</button>
        </form>

        <p class="mt-4 text-center text-xs text-ink-400">
          Não tem código? Compre no
          <a href="https://wa.me/?text=Quero%20renovar%20o%20Figs" class="underline text-ink-200">WhatsApp</a>.
        </p>
      {/if}
    </div>
  </div>
{/if}
