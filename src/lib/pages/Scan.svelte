<script>
  import Header from '../components/Header.svelte';
  import { ocrImage, ocrAvailability } from '../utils/ocr.js';
  import { matchAll } from '../utils/codeMatch.js';
  import { formatStickerLabel } from '../utils/format.js';
  import {
    addSticker, addPack, fulfillExpect, fulfillGive,
    appState, knownPeople, defaultStickersForSource, PACK_SOURCES
  } from '../stores/appState.svelte.js';
  import { commitmentsByType } from '../stores/derived.svelte.js';

  // Stages: idle | processing | review | destination | applying | done | error
  let stage = $state('idle');
  let imageUrl = $state(null);
  let ocrText = $state('');
  let ocrEngine = $state('');
  let progress = $state(0);
  let progressStage = $state('prepare'); // 'prepare' | 'load' | 'ocr'
  let errorMsg = $state('');

  // detected: [{ id, rawToken, sticker, dist, confirmed, customCode }]
  let detected = $state([]);
  let manualInput = $state('');

  // Destination
  let destination = $state(null);     // 'pack' | 'received' | 'given' | 'plain'
  let person = $state('');
  let packSource = $state('mc');
  let packCost = $state(7);

  const cap = ocrAvailability();

  function reset() {
    stage = 'idle';
    imageUrl = null;
    ocrText = '';
    ocrEngine = '';
    progress = 0;
    errorMsg = '';
    detected = [];
    manualInput = '';
    destination = null;
    person = '';
    packSource = 'mc';
    packCost = 7;
  }

  async function handleFile(e) {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    stage = 'processing';
    progress = 0;
    progressStage = 'prepare';
    errorMsg = '';
    try {
      const result = await ocrImage(file, (s, p) => {
        progressStage = s;
        progress = p;
      });
      ocrText = result.text;
      ocrEngine = result.engine;
      if (result.dataUrl) {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = result.dataUrl;
      }
      const matches = matchAll(result.text);
      // Confirma automaticamente codigos com 2+ votos; deixa desmarcado os com 1 voto
      // pra forcar revisao humana das deteccoes mais fracas.
      detected = matches.map((m, i) => ({
        id: `m${i}`,
        rawToken: m.rawToken,
        sticker: m.sticker,
        dist: m.dist,
        votes: m.votes || 1,
        confirmed: (m.votes || 1) >= 2,
        customCode: ''
      }));
      stage = 'review';
    } catch (err) {
      console.error('Scan error:', err);
      errorMsg = err?.message || 'falha no OCR';
      stage = 'error';
    } finally {
      e.target.value = '';     // permite re-selecionar o mesmo arquivo
    }
  }

  const progressLabel = $derived(() => {
    if (progressStage === 'prepare') return 'Preparando imagem…';
    if (progressStage === 'load') return 'Baixando OCR (1ª vez ~2MB)…';
    if (progressStage === 'ocr') return 'Lendo a foto…';
    return '';
  });

  function toggleConfirm(id) {
    detected = detected.map((d) => d.id === id ? { ...d, confirmed: !d.confirmed } : d);
  }

  function removeDetected(id) {
    detected = detected.filter((d) => d.id !== id);
  }

  function addManualCodes() {
    const tokens = manualInput.split(/[,\s\n]+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 0) return;
    const fresh = matchAll(tokens.join(' '));
    const known = new Set(detected.map((d) => d.sticker.code));
    let i = detected.length;
    for (const m of fresh) {
      if (known.has(m.sticker.code)) continue;
      known.add(m.sticker.code);
      detected = [...detected, {
        id: `m${i++}`,
        rawToken: m.rawToken,
        sticker: m.sticker,
        dist: m.dist,
        confirmed: true,
        customCode: ''
      }];
    }
    manualInput = '';
  }

  function goDestination() {
    if (detected.some((d) => d.confirmed)) stage = 'destination';
  }

  async function apply() {
    const codes = detected.filter((d) => d.confirmed).map((d) => d.sticker.code);
    if (codes.length === 0) return;
    stage = 'applying';

    if (destination === 'pack') {
      const count = codes.length || defaultStickersForSource(packSource);
      addPack({ cost: packCost, count, source: packSource, qty: 1 });
      for (const code of codes) addSticker(code, 1);
    } else if (destination === 'received') {
      // tenta fechar compromissos 'expect' antes de adicionar incremento manual
      for (const code of codes) {
        const opens = appState.commitments
          .filter((c) => c.type === 'expect' && c.code === code &&
                         (!person || c.person === person || c.person === '—'));
        if (opens.length > 0) fulfillExpect(opens[0].id);
        else addSticker(code, 1);
      }
    } else if (destination === 'given') {
      for (const code of codes) {
        const opens = appState.commitments
          .filter((c) => c.type === 'give' && c.code === code &&
                         (!person || c.person === person || c.person === '—'));
        if (opens.length > 0) fulfillGive(opens[0].id);
        else addSticker(code, -1);
      }
    } else { // 'plain'
      for (const code of codes) addSticker(code, 1);
    }

    stage = 'done';
  }

  const confirmedCount = $derived(() => detected.filter((d) => d.confirmed).length);
  const peopleSuggestions = $derived(() => knownPeople());

  // contagem de compromissos abertos compatíveis (pra mostrar quantos vamos fechar)
  const matchingExpect = $derived(() => {
    if (destination !== 'received') return 0;
    const codes = new Set(detected.filter((d) => d.confirmed).map((d) => d.sticker.code));
    return appState.commitments
      .filter((c) => c.type === 'expect' && codes.has(c.code) &&
                     (!person || c.person === person || c.person === '—')).length;
  });
  const matchingGive = $derived(() => {
    if (destination !== 'given') return 0;
    const codes = new Set(detected.filter((d) => d.confirmed).map((d) => d.sticker.code));
    return appState.commitments
      .filter((c) => c.type === 'give' && codes.has(c.code) &&
                     (!person || c.person === person || c.person === '—')).length;
  });
</script>

<section class="screen-enter pb-32">
  <Header sub="Foto vira ação no álbum" title="Scan" />

  <!-- IDLE: pedir foto -->
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
          Com o verso pra cima, em uma superfície lisa. Boa luz, sem sombra forte.
          O app lê os códigos e te pergunta o que aconteceu com elas.
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
          OCR: {cap.native ? 'nativo (instantâneo)' : 'tesseract.js (~2MB no 1º uso)'}
        </div>
      </div>

      <div class="card p-4 text-xs text-ink-300">
        <div class="font-semibold text-white mb-1.5">Como funciona</div>
        <ul class="space-y-1 list-disc pl-4">
          <li>O app reconhece códigos como <span class="mono text-gold-400">BRA 17</span>, <span class="mono text-gold-400">FWC 4</span>, <span class="mono text-gold-400">MC BRA</span>.</li>
          <li>Confirma o que ele leu (edita o que tiver errado).</li>
          <li>Diz o destino: <em>vieram de pacote</em>, <em>recebi em troca</em>, <em>saíram do bolo (entreguei)</em> ou só <em>somar</em>.</li>
        </ul>
      </div>

      <div class="card p-4 text-xs text-ink-300 border border-gold-400/20">
        <div class="font-semibold text-gold-400 mb-1.5">💡 Pra dar certo (importante!)</div>
        <ul class="space-y-1 list-disc pl-4">
          <li><strong>Fundo branco/claro</strong> (papel A4, mesa lisa). Tecido escuro mata o OCR.</li>
          <li><strong>Sticker grande no enquadramento</strong> — chega perto. Se o código fica do tamanho de uma formiga, não vai ler.</li>
          <li>Pra escanear vários: cascateia tipo baralho mostrando só o <strong>canto superior esquerdo</strong> (onde tá o código). Dá pra 20+ numa foto.</li>
          <li>Luz uniforme, sem reflexo direto no plástico.</li>
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
        <h2 class="display text-xl font-bold text-white mt-4">{progressLabel()}</h2>
        <p class="text-xs text-ink-300 mt-1">
          {cap.native ? 'detector nativo' : 'tesseract.js'} · pode levar uns segundos na 1ª foto
        </p>
        <div class="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full bg-gold-400 transition-all" style="width: {progress}%"></div>
        </div>
        <div class="text-[10px] text-ink-400 mt-1">{progressStage} · {progress}%</div>
      </div>
    </div>

  <!-- REVIEW -->
  {:else if stage === 'review'}
    <div class="px-5 space-y-3">
      {#if imageUrl}
        <div class="card p-2">
          <img src={imageUrl} alt="foto" class="rounded-xl max-h-40 mx-auto" />
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-400 text-center mt-2">
            {detected.length} código{detected.length === 1 ? '' : 's'} detectado{detected.length === 1 ? '' : 's'} · engine: {ocrEngine}
          </div>
        </div>
      {/if}

      {#if detected.length > 0}
        <div class="card p-3 space-y-2">
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300">confira o que o app leu</div>
          {#each detected as d (d.id)}
            <div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <button type="button"
                      class="h-7 w-7 grid place-items-center rounded-md border-2 shrink-0
                             {d.confirmed ? 'bg-pitch-400 border-pitch-400 text-ink-950' : 'border-white/20 text-transparent'}"
                      aria-label="confirmar"
                      onclick={() => toggleConfirm(d.id)}>✓</button>
              <div class="flex-1 min-w-0">
                <div class="display text-base font-bold text-white leading-none">{formatStickerLabel(d.sticker)}</div>
                <div class="text-[10px] text-ink-400 truncate">
                  {d.sticker.section}
                </div>
              </div>
              <span class="text-[10px] mono shrink-0
                           {d.votes >= 3 ? 'text-pitch-400' : d.votes >= 2 ? 'text-gold-400' : 'text-ink-400'}">
                {d.votes}×
              </span>
              <button class="text-ink-400 px-2 text-xs" onclick={() => removeDetected(d.id)} type="button" aria-label="remover">✕</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="card p-4 text-center text-sm text-ink-300">
          <div class="font-semibold text-white">O OCR não encontrou códigos válidos.</div>
          <div class="mt-1">Adicione manualmente abaixo, ou tire outra foto com melhor luz.</div>
          {#if ocrText}
            <details class="mt-3 text-left">
              <summary class="text-[11px] text-ink-400 cursor-pointer underline">ver texto bruto detectado</summary>
              <pre class="mono text-[10px] text-ink-300 whitespace-pre-wrap break-all mt-2 max-h-40 overflow-y-auto">{ocrText}</pre>
            </details>
          {/if}
        </div>
      {/if}

      <div class="card p-3">
        <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300 mb-1.5">adicionar/corrigir manualmente</div>
        <div class="flex gap-2">
          <input class="input !py-2 text-sm flex-1" placeholder="BRA 17, FWC 4, MC ARG…" bind:value={manualInput} type="text" />
          <button class="btn btn-ghost !py-2 text-xs whitespace-nowrap" onclick={addManualCodes} type="button">+ adicionar</button>
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

  <!-- DESTINATION -->
  {:else if stage === 'destination'}
    <div class="px-5 space-y-3">
      <div class="card p-3 text-center">
        <div class="text-[11px] uppercase tracking-[0.18em] text-ink-300">aplicando em</div>
        <div class="num text-3xl text-white">{confirmedCount()}</div>
        <div class="text-[11px] text-ink-300">figurinha{confirmedCount() === 1 ? '' : 's'}</div>
      </div>

      <div class="space-y-2">
        <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                     {destination === 'pack' ? 'ring-2 ring-flag-400' : ''}"
                onclick={() => destination = 'pack'}>
          <div class="font-semibold text-white">📦 Vieram do pacote</div>
          <div class="text-xs text-ink-300 mt-0.5">Registra um pacote novo e marca as figurinhas</div>
        </button>
        <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                     {destination === 'received' ? 'ring-2 ring-pitch-400' : ''}"
                onclick={() => destination = 'received'}>
          <div class="font-semibold text-white">🤝 Recebi numa troca</div>
          <div class="text-xs text-ink-300 mt-0.5">Fecha compromissos "esperando" desses códigos. O resto só soma.</div>
        </button>
        <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                     {destination === 'given' ? 'ring-2 ring-flag-400' : ''}"
                onclick={() => destination = 'given'}>
          <div class="font-semibold text-white">📤 Saíram do bolo (entreguei)</div>
          <div class="text-xs text-ink-300 mt-0.5">Fecha compromissos "prometidas pra entregar". Resto decrementa do monte.</div>
        </button>
        <button type="button" class="w-full text-left card p-4 hover:bg-white/[0.06] transition
                                     {destination === 'plain' ? 'ring-2 ring-gold-400' : ''}"
                onclick={() => destination = 'plain'}>
          <div class="font-semibold text-white">➕ Só somar à coleção</div>
          <div class="text-xs text-ink-300 mt-0.5">Incremento simples, sem mexer em pacotes ou compromissos</div>
        </button>
      </div>

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
          <div class="flex items-center gap-2">
            <label class="text-xs text-ink-300 shrink-0">{appState.settings.currency}</label>
            <input class="input !py-2 text-sm" type="number" step="0.5" min="0" bind:value={packCost} />
          </div>
        </div>
      {:else if destination === 'received' || destination === 'given'}
        <div class="card p-4 space-y-2">
          <input class="input !py-2 text-sm" placeholder="De/pra quem? (opcional)"
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
        <p class="text-sm text-ink-300 mt-1">Confira os logs pra ver a atividade.</p>
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
