<script>
  import Header from '../components/Header.svelte';
  import { ocrPaddle, ocrTesseract, prewarmPaddleOCR } from '../utils/ocr.js';
  import { matchAll } from '../utils/codeMatch.js';
  import { formatStickerLabel } from '../utils/format.js';
  import {
    addSticker, addPack, fulfillExpect, fulfillGive,
    appState, knownPeople, defaultStickersForSource, PACK_SOURCES
  } from '../stores/appState.svelte.js';
  import { mcStickerByCode, stickerByCode } from '../data/album.js';

  // Pre-warm engine quando user abre a aba
  $effect(() => {
    prewarmPaddleOCR();
  });

  let stage = $state('idle');               // idle | processing | review | destination | done | error
  let imageUrl = $state(null);
  let lastFile = $state(null);              // guarda o file pra reprocessar com Tesseract
  let ocrText = $state('');
  let ocrEngine = $state('');
  let ocrDebug = $state(null);
  let phase = $state('prepare');            // prepare | engine | models | ready | ocr
  let phasePercent = $state(null);          // null = indeterminado; numero = %
  let errorMsg = $state('');

  // detected: [{ id, sticker (album resolvido), votes, confirmed, variant }]
  // variant: 'album' | 'mc' — so faz sentido pra stickers de numero 13
  let detected = $state([]);
  let manualInput = $state('');

  // Destination
  let destination = $state(null);  // 'pack' | 'received' | 'given'
  let person = $state('');
  let packSource = $state('mc');
  let packCost = $state(7);
  let packCostMode = $state('lot');  // 'unit' | 'lot'

  function reset() {
    stage = 'idle';
    imageUrl = null;
    lastFile = null;
    ocrText = '';
    ocrEngine = '';
    ocrDebug = null;
    phase = 'prepare';
    phasePercent = null;
    errorMsg = '';
    detected = [];
    manualInput = '';
    destination = null;
    person = '';
    packSource = 'mc';
    packCost = 7;
    packCostMode = 'lot';
  }

  // Verifica se um sticker (album) tem variante MC (so codigos numero 13)
  function hasMCVariant(sticker) {
    if (!sticker?.team) return false;
    const num = sticker.code.replace(sticker.team, '');
    return num === '13' && !!mcStickerByCode[`MC-${sticker.team}`];
  }

  async function handleFile(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (imageUrl && imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    lastFile = file;
    await runOCR(file, 'paddle');
    e.target.value = '';
  }

  async function runOCR(file, engine) {
    stage = 'processing';
    phase = 'prepare';
    phasePercent = null;
    errorMsg = '';
    ocrDebug = null;
    try {
      const fn = engine === 'tesseract' ? ocrTesseract : ocrPaddle;
      const result = await fn(file, ({ phase: ph, percent }) => {
        phase = ph;
        phasePercent = percent ?? null;
      });
      ocrText = result.text;
      ocrEngine = result.engine;
      ocrDebug = result.debug;
      if (result.dataUrl) imageUrl = result.dataUrl;
      const matches = matchAll(result.text);
      detected = matches.map((m, i) => ({
        id: `m${i}`,
        sticker: m.sticker,
        votes: m.votes || 1,
        confirmed: (m.votes || 1) >= 1,
        variant: 'album'
      }));
      stage = 'review';
    } catch (err) {
      console.error('Scan error:', err);
      errorMsg = err?.message || 'falha no OCR';
      ocrDebug = err?.debug || null;
      stage = 'error';
    }
  }

  async function retryWithTesseract() {
    if (!lastFile) return;
    await runOCR(lastFile, 'tesseract');
  }

  function toggleConfirm(id) {
    detected = detected.map((d) => d.id === id ? { ...d, confirmed: !d.confirmed } : d);
  }

  function setVariant(id, v) {
    detected = detected.map((d) => d.id === id ? { ...d, variant: v } : d);
  }

  function removeDetected(id) {
    detected = detected.filter((d) => d.id !== id);
  }

  function addManualCodes() {
    const fresh = matchAll(manualInput);
    if (fresh.length === 0) return;
    const known = new Set(detected.map((d) => d.sticker.code));
    let i = detected.length;
    for (const m of fresh) {
      if (known.has(m.sticker.code)) continue;
      known.add(m.sticker.code);
      detected = [...detected, {
        id: `m${i++}`,
        sticker: m.sticker,
        votes: 1,
        confirmed: true,
        variant: 'album'
      }];
    }
    manualInput = '';
  }

  function goDestination() {
    if (detected.some((d) => d.confirmed)) stage = 'destination';
  }

  // Resolve o code real baseado na variante escolhida (album ou MC)
  function resolveCode(d) {
    if (d.variant === 'mc' && d.sticker.team) return `MC-${d.sticker.team}`;
    return d.sticker.code;
  }

  async function apply() {
    const codes = detected.filter((d) => d.confirmed).map(resolveCode);
    if (codes.length === 0) return;
    stage = 'applying';

    if (destination === 'pack') {
      const count = codes.length || defaultStickersForSource(packSource);
      const cost = packCostMode === 'lot' ? (Number(packCost) || 0) : (Number(packCost) || 0);
      // se modo unit, multiplicamos por qty (qty = 1 aqui); se lot, ja e total
      const finalCost = packCostMode === 'lot' ? cost : cost;
      addPack({ cost: finalCost, count, source: packSource, qty: 1 });
      for (const code of codes) addSticker(code, 1);
    } else if (destination === 'received') {
      for (const code of codes) {
        const opens = appState.commitments.filter((c) =>
          c.type === 'expect' && c.code === code &&
          (!person || c.person === person || c.person === '—'));
        if (opens.length > 0) fulfillExpect(opens[0].id);
        else addSticker(code, 1);
      }
    } else if (destination === 'given') {
      for (const code of codes) {
        const opens = appState.commitments.filter((c) =>
          c.type === 'give' && c.code === code &&
          (!person || c.person === person || c.person === '—'));
        if (opens.length > 0) fulfillGive(opens[0].id);
        else addSticker(code, -1);
      }
    }

    stage = 'done';
  }

  const confirmedCount = $derived(() => detected.filter((d) => d.confirmed).length);
  const peopleSuggestions = $derived(() => knownPeople());
  const has13Stickers = $derived(() => detected.some((d) => hasMCVariant(d.sticker)));

  const phaseLabel = $derived(() => {
    if (phase === 'prepare') return 'Preparando imagem…';
    if (phase === 'engine')  return 'Baixando engine OCR (1ª vez, ~10MB)…';
    if (phase === 'models')  return 'Baixando modelos (1ª vez, ~15MB)…';
    if (phase === 'ready')   return 'Engine pronto, iniciando…';
    if (phase === 'ocr')     return 'Lendo a foto (rotações 0° + 90°)…';
    return 'Processando…';
  });
  const phaseSub = $derived(() => {
    if (phase === 'engine' || phase === 'models') {
      return 'depois disso fica cacheado e instantâneo';
    }
    return null;
  });

  const matchingExpect = $derived(() => {
    if (destination !== 'received') return 0;
    const codes = new Set(detected.filter((d) => d.confirmed).map(resolveCode));
    return appState.commitments.filter((c) =>
      c.type === 'expect' && codes.has(c.code) &&
      (!person || c.person === person || c.person === '—')).length;
  });
  const matchingGive = $derived(() => {
    if (destination !== 'given') return 0;
    const codes = new Set(detected.filter((d) => d.confirmed).map(resolveCode));
    return appState.commitments.filter((c) =>
      c.type === 'give' && codes.has(c.code) &&
      (!person || c.person === person || c.person === '—')).length;
  });
</script>

<section class="screen-enter pb-32">
  <Header sub="Foto → ação na coleção" title="Scan" />

  <!-- IDLE -->
  {#if stage === 'idle'}
    <div class="px-5 space-y-4">
      <div class="card p-5 text-center">
        <div class="mx-auto h-16 w-16 grid place-items-center rounded-2xl bg-gold-400/15 border border-gold-400/35 text-gold-400 mb-3">
          <svg viewBox="0 0 24 24" class="h-8 w-8" fill="none" stroke="currentColor" stroke-width="1.7"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7h3l2-2h8l2 2h3v12H3z"/>
            <circle cx="12" cy="13" r="3.5"/>
          </svg>
        </div>
        <h2 class="display text-xl font-bold text-white">Disponha as figurinhas</h2>
        <p class="text-sm text-ink-300 mt-1 max-w-[28ch] mx-auto">
          Com o verso pra cima. O app lê os códigos e te pergunta o que aconteceu com elas.
        </p>

        <label class="btn btn-primary mt-5 cursor-pointer w-full">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 7h3l2-2h8l2 2h3v12H3z" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="13" r="3.5"/>
          </svg>
          Tirar foto
          <input type="file" accept="image/*" capture="environment" class="hidden" onchange={handleFile} />
        </label>
        <label class="btn btn-ghost mt-2 cursor-pointer w-full">
          escolher da galeria
          <input type="file" accept="image/*" class="hidden" onchange={handleFile} />
        </label>

        <div class="mt-4 text-[10px] uppercase tracking-[0.18em] text-ink-400">
          engine: PaddleOCR (alta precisão)
        </div>
      </div>

      <div class="card p-4 text-xs text-ink-300 border border-gold-400/20">
        <div class="font-semibold text-gold-400 mb-1.5">💡 Pra dar certo</div>
        <ul class="space-y-1 list-disc pl-4">
          <li><strong>Fundo claro</strong> e luz uniforme.</li>
          <li>Pra escanear várias: cascateia tipo baralho mostrando só o <strong>canto superior esquerdo</strong> (onde tá o código). Dá pra 20+ numa foto.</li>
          <li>Códigos número <strong>13</strong> precisam que você diga se é álbum oficial ou promo MC (não dá pra distinguir pela foto).</li>
        </ul>
      </div>
    </div>

  <!-- PROCESSING -->
  {:else if stage === 'processing'}
    <div class="px-5">
      <div class="card p-5 text-center">
        {#if imageUrl}
          <img src={imageUrl} alt="foto" class="rounded-2xl max-h-64 mx-auto" />
        {/if}
        <h2 class="display text-xl font-bold text-white mt-4">{phaseLabel()}</h2>
        {#if phaseSub()}
          <p class="text-xs text-ink-300 mt-1">{phaseSub()}</p>
        {/if}
        {#if phasePercent != null}
          <!-- Progresso real (durante OCR) -->
          <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full bg-gold-400 transition-all" style="width: {phasePercent}%"></div>
          </div>
          <div class="text-[10px] text-ink-400 mt-1">{phasePercent}%</div>
        {:else}
          <!-- Indeterminado (durante load) -->
          <div class="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
            <div class="absolute inset-y-0 w-1/3 bg-gold-400 rounded-full animate-pulse-slide"></div>
          </div>
          <div class="text-[10px] text-ink-400 mt-2 mono">{phase}</div>
        {/if}
      </div>
    </div>

  <!-- REVIEW -->
  {:else if stage === 'review'}
    <div class="px-5 space-y-3">
      {#if imageUrl}
        <div class="card p-2">
          <img src={imageUrl} alt="foto" class="rounded-xl max-h-40 mx-auto" />
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-400 text-center mt-2">
            {detected.length} código{detected.length === 1 ? '' : 's'} · {ocrEngine}
          </div>
          {#if ocrDebug}
            <details class="mt-2 text-[10px] text-ink-400">
              <summary class="cursor-pointer underline">debug</summary>
              <pre class="mono mt-1 whitespace-pre-wrap break-all">{JSON.stringify(ocrDebug, null, 2)}</pre>
            </details>
          {/if}
        </div>
      {/if}

      {#if detected.length > 0}
        <div class="card p-3 space-y-2">
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300">confira o que foi lido</div>
          {#each detected as d (d.id)}
            {@const mcCapable = hasMCVariant(d.sticker)}
            <div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <button type="button"
                      class="h-7 w-7 grid place-items-center rounded-md border-2 shrink-0
                             {d.confirmed ? 'bg-pitch-400 border-pitch-400 text-ink-950' : 'border-white/20 text-transparent'}"
                      aria-label="confirmar"
                      onclick={() => toggleConfirm(d.id)}>✓</button>
              <div class="flex-1 min-w-0">
                <div class="display text-base font-bold text-white leading-none">
                  {d.variant === 'mc' ? `${d.sticker.team} 13 (MC)` : formatStickerLabel(d.sticker)}
                </div>
                <div class="text-[10px] text-ink-400 truncate">
                  {d.variant === 'mc' ? 'Promo McDonald\'s' : d.sticker.section}
                </div>
                {#if mcCapable}
                  <div class="mt-1.5 flex gap-1 text-[10px]">
                    <button type="button"
                            onclick={() => setVariant(d.id, 'album')}
                            class="px-2 py-0.5 rounded-full transition
                                   {d.variant === 'album' ? 'bg-pitch-400/20 text-pitch-400 ring-1 ring-pitch-400/40' : 'bg-white/5 text-ink-400'}">
                      álbum oficial
                    </button>
                    <button type="button"
                            onclick={() => setVariant(d.id, 'mc')}
                            class="px-2 py-0.5 rounded-full transition
                                   {d.variant === 'mc' ? 'bg-gold-400/20 text-gold-400 ring-1 ring-gold-400/40' : 'bg-white/5 text-ink-400'}">
                      🍔 promo MC
                    </button>
                  </div>
                {/if}
              </div>
              {#if d.votes > 1}
                <span class="text-[10px] mono shrink-0 text-pitch-400">{d.votes}×</span>
              {/if}
              <button class="text-ink-400 px-2 text-xs" onclick={() => removeDetected(d.id)} type="button" aria-label="remover">✕</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="card p-4 text-center text-sm text-ink-300">
          <div class="font-semibold text-white">Nenhum código detectado.</div>
          <div class="mt-1">Adicione manualmente abaixo ou tire outra foto.</div>
          {#if ocrText}
            <details class="mt-3 text-left">
              <summary class="text-[11px] text-ink-400 cursor-pointer underline">texto bruto detectado</summary>
              <pre class="mono text-[10px] text-ink-300 whitespace-pre-wrap break-all mt-2 max-h-40 overflow-y-auto">{ocrText}</pre>
            </details>
          {/if}
        </div>
      {/if}

      <div class="card p-3">
        <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300 mb-1.5">adicionar/corrigir manualmente</div>
        <div class="flex gap-2">
          <input class="input !py-2 text-sm flex-1" placeholder="BRA 17, FWC 4, MC ARG…" bind:value={manualInput} type="text" />
          <button class="btn btn-ghost !py-2 text-xs whitespace-nowrap" onclick={addManualCodes} type="button">+ add</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-ghost" onclick={reset} type="button">descartar</button>
        <button class="btn btn-primary" onclick={goDestination} type="button"
                disabled={confirmedCount() === 0}>
          escolher destino ({confirmedCount()})
        </button>
      </div>
    </div>

  <!-- DESTINATION (agrupado Entrada / Saída) -->
  {:else if stage === 'destination'}
    <div class="px-5 space-y-4">
      <div class="card p-3 text-center">
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">aplicando em</div>
        <div class="num text-3xl text-white">{confirmedCount()}</div>
        <div class="text-[11px] text-ink-300">figurinha{confirmedCount() === 1 ? '' : 's'}</div>
      </div>

      <!-- ENTRADA -->
      <div>
        <div class="px-1 mb-2 text-[10px] uppercase tracking-[0.22em] text-pitch-400">entrada (somando à coleção)</div>
        <div class="space-y-2">
          <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                       {destination === 'pack' ? 'ring-2 ring-pitch-400' : ''}"
                  onclick={() => destination = 'pack'}>
            <div class="font-semibold text-white">📦 Vieram do pacote</div>
            <div class="text-xs text-ink-300 mt-0.5">Registra um pacote novo e marca todas</div>
          </button>
          <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                       {destination === 'received' ? 'ring-2 ring-pitch-400' : ''}"
                  onclick={() => destination = 'received'}>
            <div class="font-semibold text-white">🤝 Recebi numa troca</div>
            <div class="text-xs text-ink-300 mt-0.5">Fecha compromissos "esperando" automaticamente</div>
          </button>
        </div>
      </div>

      <!-- SAÍDA -->
      <div>
        <div class="px-1 mb-2 text-[10px] uppercase tracking-[0.22em] text-flag-400">saída (saindo do bolo)</div>
        <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                     {destination === 'given' ? 'ring-2 ring-flag-400' : ''}"
                onclick={() => destination = 'given'}>
          <div class="font-semibold text-white">📤 Entreguei numa troca</div>
          <div class="text-xs text-ink-300 mt-0.5">Fecha compromissos "prometidas" automaticamente</div>
        </button>
      </div>

      <!-- Detalhes do destino selecionado -->
      {#if destination === 'pack'}
        <div class="card p-4 space-y-3">
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300">detalhes do pacote</div>
          <div class="flex gap-2">
            {#each PACK_SOURCES as src}
              <button type="button"
                      class="flex-1 btn !py-2 text-xs {packSource === src ? 'btn-primary' : 'btn-ghost'}"
                      onclick={() => packSource = src}>
                {src === 'mc' ? '🍔 mc (5)' : '🏪 banca (7)'}
              </button>
            {/each}
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-ink-300">Preço ({appState.settings.currency})</label>
              <div class="flex gap-1 text-[10px] uppercase tracking-wide">
                <button type="button"
                        onclick={() => packCostMode = 'unit'}
                        class="px-1.5 py-0.5 rounded {packCostMode === 'unit' ? 'bg-flag-400/20 text-flag-400' : 'text-ink-400'}">
                  por pacote
                </button>
                <button type="button"
                        onclick={() => packCostMode = 'lot'}
                        class="px-1.5 py-0.5 rounded {packCostMode === 'lot' ? 'bg-flag-400/20 text-flag-400' : 'text-ink-400'}">
                  lote
                </button>
              </div>
            </div>
            <input class="input !py-2 text-sm mono" type="number" step="0.5" min="0" bind:value={packCost} />
          </div>
        </div>
      {:else if destination === 'received' || destination === 'given'}
        <div class="card p-4 space-y-2">
          <input class="input !py-2 text-sm" placeholder={destination === 'received' ? 'De quem? (opcional)' : 'Pra quem? (opcional)'}
                 bind:value={person} list="scan-people" type="text" />
          <datalist id="scan-people">{#each peopleSuggestions() as p}<option value={p}></option>{/each}</datalist>
          {#if destination === 'received' && matchingExpect() > 0}
            <div class="text-[11px] text-pitch-400">
              ✓ {matchingExpect()} compromisso{matchingExpect() === 1 ? '' : 's'} "esperando" será{matchingExpect() === 1 ? '' : 'ão'} fechado{matchingExpect() === 1 ? '' : 's'}
            </div>
          {/if}
          {#if destination === 'given' && matchingGive() > 0}
            <div class="text-[11px] text-flag-400">
              ✓ {matchingGive()} compromisso{matchingGive() === 1 ? '' : 's'} "prometida" será{matchingGive() === 1 ? '' : 'ão'} fechado{matchingGive() === 1 ? '' : 's'}
            </div>
          {/if}
        </div>
      {/if}

      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-ghost" onclick={() => stage = 'review'} type="button">voltar</button>
        <button class="btn btn-primary" onclick={apply} disabled={!destination} type="button">
          aplicar
        </button>
      </div>
    </div>

  <!-- DONE -->
  {:else if stage === 'done'}
    <div class="px-5">
      <div class="card p-6 text-center">
        <div class="mx-auto h-14 w-14 rounded-full bg-pitch-400/20 border border-pitch-400/50 text-pitch-400 grid place-items-center mb-3">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12l5 5 9-11" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="display text-xl font-bold text-white">Aplicado!</h2>
        <p class="text-sm text-ink-300 mt-1">Veja a atividade nos logs.</p>
        <button class="btn btn-primary mt-5 w-full" onclick={reset} type="button">scanear outra</button>
        <a class="btn btn-ghost mt-2 w-full" href="#logs">ver logs</a>
      </div>
    </div>

  <!-- ERROR -->
  {:else if stage === 'error'}
    <div class="px-5">
      <div class="card p-5 text-center">
        <h2 class="display text-lg font-bold text-white">Algo deu errado</h2>
        <p class="text-sm text-ink-300 mt-1">{errorMsg}</p>
        <button class="btn btn-primary mt-4 w-full" onclick={reset} type="button">tentar de novo</button>
      </div>
    </div>
  {/if}
</section>
