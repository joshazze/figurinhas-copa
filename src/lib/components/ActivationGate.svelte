<script>
  import { redeem } from '../api/auth.js';
  import { ApiError } from '../api/client.js';
  import { isAuthenticated } from '../stores/authState.svelte.js';
  import { pullOnBoot } from '../api/sync.js';

  let code = $state('');
  let loading = $state(false);
  let error = $state('');

  const ERROR_MESSAGES = {
    invalid_code: 'Código inválido. Confere as letras e os hífens.',
    code_not_found: 'Esse código não foi emitido por nós.',
    code_revoked: 'Esse código foi revogado.',
    subscription_expired: 'Esse código expirou. Renove pra continuar.',
    device_limit_reached: 'Limite de aparelhos atingido. Use um dos já cadastrados.',
    network: 'Sem internet ou servidor fora do ar. Tente de novo.',
  };

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    error = '';
    loading = true;
    try {
      await redeem(code);
      await pullOnBoot();
    } catch (err) {
      const key = err instanceof ApiError ? err.code : 'network';
      error = ERROR_MESSAGES[key] || (err.message || 'Erro inesperado.');
    } finally {
      loading = false;
    }
  }

  function format(value) {
    const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    return raw.replace(/^(FIGS)(.{0,4})(.{0,4})(.{0,4})(.{0,4}).*/, (_, a, b, c, d, e) => {
      return [a, b, c, d, e].filter(Boolean).join('-');
    });
  }

  function onInput(e) {
    code = format(e.currentTarget.value);
  }
</script>

{#if !isAuthenticated()}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#050b1f] px-6">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <div class="text-5xl font-display tracking-wide text-gold">FIGS</div>
        <div class="mt-1 text-xs uppercase tracking-[0.3em] text-ink-300">cromos da copa 2026</div>
      </div>

      <h1 class="text-xl font-medium text-ink-200">Ativar acesso</h1>
      <p class="mt-2 text-sm text-ink-300">
        Cole o seu código de ativação pra liberar scan automático e sincronização entre aparelhos.
      </p>

      <form on:submit={submit} class="mt-6 space-y-3">
        <input
          type="text"
          inputmode="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="FIGS-XXXX-XXXX-XXXX-XXXX"
          value={code}
          on:input={onInput}
          class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 font-mono text-base tracking-wider text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
        />

        {#if error}
          <p class="text-sm text-flag">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading || code.length < 24}
          class="w-full rounded-xl bg-gold py-3 font-medium text-[#050b1f] transition disabled:opacity-50"
        >
          {loading ? 'Ativando...' : 'Ativar'}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-ink-400">
        Não tem código? Compre por <span class="text-ink-200">R$ 7/mês</span> no
        <a href="https://wa.me/?text=Quero%20comprar%20o%20acesso%20ao%20Figs" class="underline">WhatsApp</a>.
      </p>
    </div>
  </div>
{/if}
