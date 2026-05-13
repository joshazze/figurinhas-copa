<script>
  import { signup, login, renew } from '../api/auth.js';
  import { ApiError } from '../api/client.js';
  import { auth, isAuthenticated } from '../stores/authState.svelte.js';
  import { pullOnBoot } from '../api/sync.svelte.js';

  // 'landing' | 'signup' | 'login' | 'renew'
  let view = $state('landing');

  let email = $state(auth.email || '');
  let password = $state('');
  let code = $state('');
  let loading = $state(false);
  let error = $state('');

  const ERROR_MESSAGES = {
    invalid_code: 'Código inválido. Confere as letras e os hífens.',
    code_not_found: 'Esse código não foi emitido por nós.',
    code_revoked: 'Esse código foi revogado.',
    code_already_used: 'Esse código já foi usado.',
    email_already_registered: 'Esse email já tem conta. Use "Entrar" ou "Renovar".',
    invalid_credentials: 'Email ou senha incorretos.',
    subscription_expired: 'Sua assinatura expirou. Use "Renovar" com um novo código.',
    network: 'Sem internet ou servidor fora do ar. Tente de novo.',
  };

  function reset(nextView) {
    error = '';
    password = '';
    code = '';
    view = nextView;
  }

  function formatCode(value) {
    const raw = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (!raw) return '';
    return raw.replace(/^(FIGS)(.{0,4})(.{0,4})(.{0,4})(.{0,4}).*/, (_, a, b, c, d, e) => {
      return [a, b, c, d, e].filter(Boolean).join('-');
    });
  }

  async function handle(action) {
    if (loading) return;
    error = '';
    loading = true;
    try {
      if (action === 'signup') await signup({ email, password, code });
      else if (action === 'login') await login({ email, password });
      else if (action === 'renew') await renew({ email, password, code });
      await pullOnBoot();
    } catch (err) {
      const key = err instanceof ApiError ? err.code : 'network';
      error = ERROR_MESSAGES[key] || (err.message || 'Erro inesperado.');
    } finally {
      loading = false;
    }
  }

  const titles = {
    signup: 'Criar conta',
    login: 'Entrar',
    renew: 'Renovar assinatura',
  };

  const subtitles = {
    signup: 'Email, senha e o código que você recebeu por WhatsApp.',
    login: 'Acesse sua conta no aparelho.',
    renew: 'Estenda sua assinatura por mais 30 dias com um novo código.',
  };

  function needsCode() {
    return view === 'signup' || view === 'renew';
  }

  function canSubmit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (password.length < 6 && view === 'signup') return false;
    if (password.length < 1 && view !== 'signup') return false;
    if (needsCode() && code.replace(/[^A-Z0-9]/g, '').length < 20) return false;
    return true;
  }
</script>

{#if !isAuthenticated()}
  <div class="fixed inset-0 z-50 overflow-y-auto bg-[#050b1f]">
    <div class="mx-auto flex min-h-dvh max-w-sm flex-col px-6 py-10">
      <div class="mb-8 text-center">
        <div class="text-5xl font-display tracking-wide text-gold">FIGS</div>
        <div class="mt-1 text-xs uppercase tracking-[0.3em] text-ink-300">cromos da copa 2026</div>
      </div>

      {#if view === 'landing'}
        <div class="flex flex-col gap-3">
          <button
            type="button"
            on:click={() => reset('signup')}
            class="w-full rounded-xl bg-gold py-3 font-medium text-[#050b1f] transition active:scale-[0.99]"
          >Criar conta</button>

          <button
            type="button"
            on:click={() => reset('login')}
            class="w-full rounded-xl border border-white/20 bg-white/[0.05] py-3 font-medium text-ink-200 transition active:scale-[0.99]"
          >Entrar</button>

          <button
            type="button"
            on:click={() => reset('renew')}
            class="w-full rounded-xl border border-white/10 bg-transparent py-3 font-medium text-ink-300 transition active:scale-[0.99]"
          >Renovar conta</button>
        </div>

        <p class="mt-8 text-center text-xs text-ink-400">
          Não tem código? Compre por <span class="text-ink-200">R$ 7/mês</span> no
          <a href="https://wa.me/?text=Quero%20comprar%20o%20acesso%20ao%20Figs" class="underline">WhatsApp</a>.
        </p>
      {:else}
        <div class="mb-1 flex items-center justify-between">
          <h1 class="text-xl font-medium text-ink-200">{titles[view]}</h1>
          <button
            type="button"
            on:click={() => reset('landing')}
            class="text-xs uppercase tracking-wider text-ink-300 underline-offset-2 hover:underline"
          >voltar</button>
        </div>
        <p class="text-sm text-ink-300">{subtitles[view]}</p>

        <form on:submit|preventDefault={() => handle(view)} class="mt-6 space-y-3">
          <input
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="Email"
            bind:value={email}
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
          />

          <input
            type="password"
            autocomplete={view === 'signup' ? 'new-password' : 'current-password'}
            placeholder={view === 'signup' ? 'Senha (mínimo 6)' : 'Senha'}
            bind:value={password}
            class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
          />

          {#if needsCode()}
            <input
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              placeholder="FIGS-XXXX-XXXX-XXXX-XXXX"
              value={code}
              on:input={(e) => (code = formatCode(e.currentTarget.value))}
              class="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 font-mono text-base tracking-wider text-ink-200 placeholder:text-ink-400/60 focus:outline-none focus:ring-2 focus:ring-gold/60"
            />
          {/if}

          {#if error}
            <p class="text-sm text-flag">{error}</p>
          {/if}

          <button
            type="submit"
            disabled={loading || !canSubmit()}
            class="w-full rounded-xl bg-gold py-3 font-medium text-[#050b1f] transition disabled:opacity-50"
          >
            {#if loading}
              Processando...
            {:else if view === 'signup'}
              Criar conta
            {:else if view === 'login'}
              Entrar
            {:else}
              Renovar conta
            {/if}
          </button>
        </form>

        {#if view === 'login'}
          <p class="mt-6 text-center text-xs text-ink-400">
            Conta expirada?
            <button type="button" on:click={() => reset('renew')} class="text-ink-200 underline">renove com um novo código</button>.
          </p>
        {:else if view === 'signup'}
          <p class="mt-6 text-center text-xs text-ink-400">
            Já tem conta?
            <button type="button" on:click={() => reset('login')} class="text-ink-200 underline">entrar</button>.
          </p>
        {:else}
          <p class="mt-6 text-center text-xs text-ink-400">
            Precisa de novo código? Compre por <span class="text-ink-200">R$ 7</span> no
            <a href="https://wa.me/?text=Quero%20renovar%20o%20Figs" class="underline">WhatsApp</a>.
          </p>
        {/if}
      {/if}
    </div>
  </div>
{/if}
