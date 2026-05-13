<script>
  import Header from '../components/Header.svelte';
  import { matchAll, compareStickers } from '../utils/codeMatch.js';
  import { formatStickerLabel } from '../utils/format.js';
  import { isNative } from '../utils/ocr.js';
  import { scan as scanViaBackend, scanStream, scanRegion, fileFingerprint, postScanFeedback } from '../api/scan.js';
  import { ApiError } from '../api/client.js';
  import {
    addSticker, addPack, fulfillExpect, fulfillGive,
    appState, knownPeople, defaultStickersForSource, PACK_SOURCES
  } from '../stores/appState.svelte.js';
  import { mcStickerByCode, stickerByCode } from '../data/album.js';
  import MatrixReveal from '../components/MatrixReveal.svelte';
  import BboxCrop from '../components/BboxCrop.svelte';
  import ScanOverlay from '../components/ScanOverlay.svelte';

  // Bump em toda mudanca do fluxo Scan ou do backend OCR. Ver historico abaixo.
  // 3.0.0  backend OCR (RapidOCR + fuzzy match)
  // 3.1.0  multipass + CLAHE preprocessing + voting
  // 3.1.1  fuzzy threshold 92 + min 3 chars (anti-falso-positivo)
  // 3.2.0  resize 1800px + 9 passes (drop halves) + 15s tipico
  // 3.3.0  early-exit em ~3-5s pra fotos boas (single-pass high-conf)
  // 3.4.0  lightbox: toca na foto pra ampliar
  // 3.5.0  early-reject: foto sem cromo aborta em ~2s em vez de 15-25s
  // 3.6.0  early-accept agressivo: 3+ good matches num pass -> exit. <8s mesmo com 50 cromos
  // 3.7.0  streaming NDJSON: figurinhas aparecem na tela uma a uma + tentatives + bbox crop
  // 3.8.0  matrix reveal nos cards + noise filter de tentatives (FIFA WORLD CUP 2026 etc)
  // 3.9.0  bbox crop em cada card: IA cobre a regiao da foto onde leu o codigo
  // 3.10.0 scanner futurista navega foto + confirmadas com foto crop + tentatives circuladas na foto
  // 3.11.0 tap na tentative -> IA reanalisa a regiao com mais precisao (deep OCR focado)
  // 3.11.1 lightbox stacking fix (saiu de dentro da <section>, fundo 100% opaco)
  // 3.12.0 lightbox mantem markers/circles + upload 2400px (era 1600px) pra mais detalhe
  // 3.13.0 1 Detection por figurinha fisica (sem duplicar markers) + backend cap 2400
  // 3.14.0 lightbox: zoom + tap em regiao manda crop pro /scan/region (resgate ad-hoc)
  // 3.15.0 lightbox: zoom com pan/scroll real + marcar varias areas e analisar em batch
  // 3.15.1 precisao: cutoff 92->94, len delta 2->1, ocr_conf >= 0.88 pra non-exact match
  // 3.15.2 recall: 9 tiles 3x3 (era 4 quadrants) + batch reanalisar tentatives + feedback
  // 3.15.3 learning: correcoes alimentam alias cache (rapido pra fragments ja vistos)
  //                  + false_positives viram blacklist · botoes editar/excluir lado a lado
  // 3.16.0 seal detector: balao verde como pre-detector. OCR so nos balões = sem dupes
  //                       + latencia 5-10x menor + precisao maior
  const SCAN_VERSION = '3.16.0';

  let stage = $state('idle');               // idle | processing | review | destination | done | error
  let imageUrl = $state(null);
  let lightboxOpen = $state(false);
  let lightboxZoom = $state(1);             // 1, 2, 3
  let lightboxScanMode = $state(false);
  let lightboxScanLoading = $state(false);
  let lightboxScanError = $state('');
  // pendingMarks: tap points the user added in scan-mode but hasn't analyzed yet.
  // [{id, bbox: [[x,y]...] in 0..1, status: 'pending'|'loading'|'done'|'failed'}]
  let pendingMarks = $state([]);
  let _markSeq = 0;
  let lightboxBatchProgress = $state(null);  // {done, total} when batch running
  let lastFile = $state(null);              // guarda o file pra reprocessar com Tesseract
  let ocrText = $state('');
  let ocrEngine = $state('');
  let ocrDebug = $state(null);
  let phase = $state('prepare');            // prepare | engine | models | ready | ocr
  let phasePercent = $state(null);          // null = indeterminado; numero = %
  let phaseLabel = $state('');              // human-readable label streamed from backend
  let errorMsg = $state('');

  // detected: [{ id, sticker, votes, confirmed, variant, bbox, confidence }]
  let detected = $state([]);
  // tentatives: [{ id, raw_text, bbox, confidence }]
  let tentatives = $state([]);
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
    phaseLabel = '';
    errorMsg = '';
    detected = [];
    tentatives = [];
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
    await runScan(file);
    e.target.value = '';
  }

  const BACKEND_ERROR_MESSAGES = {
    pro_tier_required: 'Scan automático é exclusivo do plano Pro. Faça upgrade pra liberar.',
    session_expired: 'Sessão expirou. Reabra o app pra logar de novo.',
    invalid_token: 'Sessão inválida. Reabra o app pra logar de novo.',
    missing_bearer: 'Você precisa entrar antes de escanear.',
    no_jwt: 'Você precisa entrar antes de escanear.',
    image_too_large: 'Foto muito grande. Tire uma menor.',
    network: 'Sem conexão. Verifique sua internet.',
  };

  let _seq = 0; // monotonic counter for stable card ids during streaming

  function addConfirmedDetection(d) {
    const sticker = stickerByCode[d.code] || mcStickerByCode[d.code];
    if (!sticker) return;
    const variant = d.code.startsWith('MC-') ? 'mc' : 'album';
    // Backend now emits ONE Detection per physical sticker — never multiply by
    // copies here, or two same-code stickers in one frame would render four cards.
    const next = [...detected, {
      id: `d${++_seq}`,
      sticker, variant,
      votes: d.status === 'verde' ? 6 : 2,
      confirmed: d.status === 'verde',
      confidence: d.confidence,
      bbox: d.bbox || null,
      status: d.status,
      raw_text: d.raw_text || null,
    }];
    next.sort((a, b) => {
      if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
      return compareStickers(a.sticker, b.sticker);
    });
    detected = next;
  }

  function addTentative(d) {
    tentatives = [...tentatives, {
      id: `t${++_seq}`,
      raw_text: d.raw_text,
      bbox: d.bbox || null,
      confidence: d.confidence,
      loading: false,
      failed: false,
      selected: true,   // default-checked so the batch button works in 1 tap
    }];
  }

  function toggleTentativeSelect(id) {
    tentatives = tentatives.map((t) => t.id === id ? { ...t, selected: !t.selected } : t);
  }

  function selectAllTentatives(value) {
    tentatives = tentatives.map((t) => ({ ...t, selected: value }));
  }

  async function reanalyzeSelectedTentatives() {
    if (!lastFile) return;
    const targets = tentatives.filter((t) => t.selected && !t.loading && !t.failed && t.bbox);
    if (targets.length === 0) return;
    // mark all loading at once for visual feedback
    tentatives = tentatives.map((t) => targets.find((x) => x.id === t.id) ? { ...t, loading: true, failed: false } : t);
    for (const t of targets) {
      try {
        const res = await scanRegion(lastFile, t.bbox);
        if (res?.matched && res.detection) {
          // promote
          tentatives = tentatives.filter((x) => x.id !== t.id);
          addConfirmedDetection(res.detection);
        } else {
          setTentativeFlag(t.id, { loading: false, failed: true });
        }
      } catch {
        setTentativeFlag(t.id, { loading: false, failed: true });
      }
    }
  }

  // ===== Feedback loop =====

  let editingDetected = $state(null);  // {id, code, sticker, ...} when modal open
  let editValue = $state('');
  let editSubmitting = $state(false);
  let toastMsg = $state('');

  function openEdit(d) {
    editingDetected = d;
    editValue = d.variant === 'mc' ? `MC-${d.sticker.team}` : d.sticker.code;
  }

  function closeEdit() {
    editingDetected = null;
    editValue = '';
    editSubmitting = false;
  }

  function flashToast(msg) {
    toastMsg = msg;
    setTimeout(() => { toastMsg = ''; }, 2200);
  }

  async function submitCorrection() {
    if (!editingDetected || editSubmitting) return;
    const orig = editingDetected.variant === 'mc'
      ? `MC-${editingDetected.sticker.team}`
      : editingDetected.sticker.code;
    const corrected = editValue.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    if (!corrected || corrected === orig) { closeEdit(); return; }
    editSubmitting = true;
    try {
      await postScanFeedback({
        kind: 'correction',
        original_code: orig,
        correct_code: corrected,
        // raw_text MUST be the actual OCR string the backend produced — that's
        // what the learned-alias cache keys on. Falls back to canonical code if
        // the detection came from an older client without the field.
        raw_text: editingDetected.raw_text || orig,
        bbox: editingDetected.bbox,
        image_hash: fileFingerprint(lastFile),
      });
      // Apply the correction locally too (replace sticker on the card).
      const newSticker = stickerByCode[corrected] || mcStickerByCode[corrected];
      if (newSticker) {
        const variant = corrected.startsWith('MC-') ? 'mc' : 'album';
        detected = detected.map((d) => d.id === editingDetected.id
          ? { ...d, sticker: newSticker, variant, confirmed: true } : d);
        flashToast('Correção salva. Obrigado!');
      } else {
        flashToast('Código não encontrado no álbum');
      }
    } catch {
      flashToast('Não consegui salvar o feedback');
    } finally {
      closeEdit();
    }
  }

  async function reportFalsePositive(d) {
    detected = detected.filter((x) => x.id !== d.id);
    try {
      await postScanFeedback({
        kind: 'false_positive',
        original_code: d.variant === 'mc' ? `MC-${d.sticker.team}` : d.sticker.code,
        raw_text: d.raw_text || null,
        bbox: d.bbox,
        image_hash: fileFingerprint(lastFile),
      });
      flashToast('Marcada como erro. Obrigado!');
    } catch {}
  }

  function setTentativeFlag(id, patch) {
    tentatives = tentatives.map((t) => t.id === id ? { ...t, ...patch } : t);
  }

  // Build a normalized bbox (4 corner points 0..1) around a single tap point.
  function bboxAroundTap(clientX, clientY, rect, size = 0.10) {
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    const half = size / 2;
    const cx = Math.max(half, Math.min(1 - half, x));
    const cy = Math.max(half, Math.min(1 - half, y));
    return [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx + half, cy + half],
      [cx - half, cy + half],
    ];
  }

  // Add a mark at the tapped position. Doesn't analyze yet — user may
  // tap several places before hitting "analisar N marcadas".
  function addMark(clientX, clientY, target) {
    const img = target.querySelector('img');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }
    const bbox = bboxAroundTap(clientX, clientY, rect, 0.12);
    pendingMarks = [...pendingMarks, {
      id: `m${++_markSeq}`,
      bbox,
      status: 'pending',
    }];
  }

  function removeMark(id) {
    pendingMarks = pendingMarks.filter((m) => m.id !== id);
  }

  function clearMarks() {
    pendingMarks = [];
  }

  function setMarkStatus(id, status) {
    pendingMarks = pendingMarks.map((m) => m.id === id ? { ...m, status } : m);
  }

  async function analyzePendingMarks() {
    if (!lastFile || pendingMarks.length === 0 || lightboxScanLoading) return;
    lightboxScanError = '';
    lightboxScanLoading = true;
    lightboxBatchProgress = { done: 0, total: pendingMarks.length };
    let identifiedCount = 0;
    let failedCount = 0;
    const marks = [...pendingMarks];
    for (const mark of marks) {
      setMarkStatus(mark.id, 'loading');
      try {
        const res = await scanRegion(lastFile, mark.bbox);
        if (res?.matched && res.detection) {
          addConfirmedDetection(res.detection);
          setMarkStatus(mark.id, 'done');
          identifiedCount++;
        } else {
          setMarkStatus(mark.id, 'failed');
          failedCount++;
          // user pointed at a spot expecting a sticker; backend couldn't read it.
          // Log as 'missed' so we can target that region in future model passes.
          postScanFeedback({
            kind: 'missed', bbox: mark.bbox, image_hash: fileFingerprint(lastFile),
          }).catch(() => {});
        }
      } catch {
        setMarkStatus(mark.id, 'failed');
        failedCount++;
      }
      lightboxBatchProgress = { done: lightboxBatchProgress.done + 1, total: marks.length };
    }
    lightboxScanLoading = false;
    lightboxBatchProgress = null;
    // Keep failed marks visible (so user knows which didn't work). Auto-prune
    // the successful ones after 1.5s.
    setTimeout(() => {
      pendingMarks = pendingMarks.filter((m) => m.status !== 'done');
    }, 1500);
    if (identifiedCount > 0 && failedCount === 0) {
      lightboxScanMode = false;
    }
    if (identifiedCount === 0 && failedCount > 0) {
      lightboxScanError = `${failedCount === 1 ? 'nada identificado' : `nenhuma das ${failedCount} foi identificada`}`;
      setTimeout(() => { lightboxScanError = ''; }, 3000);
    }
  }

  async function scrutinizeTentative(t) {
    if (!lastFile || !t.bbox || t.loading) return;
    setTentativeFlag(t.id, { loading: true, failed: false });
    try {
      const res = await scanRegion(lastFile, t.bbox);
      if (res?.matched && res.detection) {
        // Promote tentative → confirmed.
        tentatives = tentatives.filter((x) => x.id !== t.id);
        addConfirmedDetection(res.detection);
      } else {
        // Couldn't identify even on second pass; let the user type it.
        manualInput = (t.raw_text || '').toUpperCase().replace(/[^A-Z0-9\- ]/g, '');
        setTentativeFlag(t.id, { loading: false, failed: true });
      }
    } catch {
      setTentativeFlag(t.id, { loading: false, failed: true });
    }
  }

  async function runScan(file) {
    stage = 'processing';
    phase = 'upload';
    phasePercent = 0;
    phaseLabel = 'Enviando foto...';
    errorMsg = '';
    ocrDebug = null;
    detected = [];
    tentatives = [];
    try {
      phase = 'ocr';
      const final = await scanStream(file, (event) => {
        if (event.type === 'progress') {
          phasePercent = event.pct;
          phaseLabel = event.label;
        } else if (event.type === 'detection' && event.code) {
          addConfirmedDetection(event);
        } else if (event.type === 'tentative') {
          addTentative(event);
        } else if (event.type === 'done') {
          ocrDebug = {
            confirmed: event.confirmed,
            tentative: event.tentative,
            elapsed_ms: event.elapsed_ms,
          };
        }
      });
      ocrEngine = `backend ${final?.elapsed_ms ? `(${(final.elapsed_ms/1000).toFixed(1)}s)` : ''}`;
      stage = 'review';
    } catch (err) {
      if (import.meta.env.DEV) console.error('Scan error:', err);
      const key = err.code || (err instanceof ApiError ? err.code : 'network');
      errorMsg = BACKEND_ERROR_MESSAGES[key] || (err.message || 'falha no scan');
      stage = 'error';
    }
  }

  function ownedFor(d) {
    const code = d.variant === 'mc' ? `MC-${d.sticker.team}` : d.sticker.code;
    return appState.collected[code] || 0;
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
    // Normaliza pra uppercase porque o matcher exige caixa-alta. Mobile
    // keyboards costumam comecar minusculo e isso fazia o input falhar.
    const text = (manualInput || '').toUpperCase();
    const fresh = matchAll(text);
    if (fresh.length === 0) {
      manualInput = '';
      return;
    }
    let i = detected.length;
    const additions = fresh.map((m) => ({
      id: `m${i++}`,
      sticker: m.sticker,
      votes: 1,
      confirmed: true,
      variant: 'album'
    }));
    // re-ordena a lista inteira pelo padrao (CAPA -> FWC -> times -> MC)
    detected = [...detected, ...additions].sort((a, b) => compareStickers(a.sticker, b.sticker));
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
      // Veio de pacote: simplesmente registra as figurinhas. Ineditas viram
      // coleção, ja conhecidas viram repetidas (vao pro bolo).
      // O cadastro de pacote em si (preco, qtd) fica na aba Pacotes — Scan
      // so registra as figurinhas.
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

  // phaseLabel is now a streamed $state value (set by the backend NDJSON
  // 'progress' events). No derived fallback needed.
  const phaseSub = $derived(() => {
    if (detected.length === 0 && tentatives.length === 0) return null;
    const c = detected.length;
    const t = tentatives.length;
    return `${c} ${c === 1 ? 'figurinha' : 'figurinhas'}${t > 0 ? ` · ${t} possíve${t === 1 ? 'l' : 'is'}` : ''} até agora`;
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
  <Header sub="Foto → ação na coleção" title="Scan">
    {#snippet right()}
      <span class="mono text-[10px] text-ink-400 px-2 py-1 rounded-md border border-white/10 bg-white/[0.03]">
        v{SCAN_VERSION}
      </span>
    {/snippet}
  </Header>

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
          engine: servidor (Pro)
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
    <div class="px-5 space-y-3">
      <!-- Foto original com overlay scanner futurista. Tentatives ficam
           CIRCULADAS aqui; confirmadas viram cards embaixo (multa-style). -->
      <div class="card p-2">
        {#if imageUrl}
          <ScanOverlay imageUrl={imageUrl} scanning={true}
                       bboxes={[
                         ...detected.map((d) => ({ id: d.id, bbox: d.bbox, status: d.status })),
                         ...tentatives.map((t) => ({ id: t.id, bbox: t.bbox, status: 'tentative' })),
                       ]} />
        {/if}
        <div class="mt-3 px-1">
          <div class="flex items-center justify-between gap-2">
            <h2 class="display text-sm font-bold text-white truncate">{phaseLabel || 'Processando…'}</h2>
            <span class="num text-[11px] text-gold-400">{phasePercent ?? 0}%</span>
          </div>
          <div class="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
            <div class="h-full bg-gold-400 transition-all duration-300"
                 style="width: {phasePercent ?? 0}%"></div>
          </div>
          {#if phaseSub()}
            <p class="text-[10px] text-ink-400 mt-1">{phaseSub()}</p>
          {/if}
        </div>
      </div>

      <!-- Confirmadas (multa de trânsito): crop + matrix reveal + código.
           Cards aparecem 1 a 1 conforme o stream confirma. -->
      {#if detected.length > 0}
        <div class="card p-3">
          <div class="text-[10px] uppercase tracking-[0.18em] text-pitch-400 mb-2">
            identificadas ({detected.length})
          </div>
          <div class="grid grid-cols-3 gap-2">
            {#each detected as d (d.id)}
              <div class="rounded-lg border border-pitch-500/40 bg-pitch-500/10 p-2
                          flex flex-col items-center gap-1.5
                          animate-[fadein_0.3s_ease-out] overflow-hidden">
                <BboxCrop imageUrl={imageUrl} bbox={d.bbox} size={56} scanning={false} />
                <div class="text-xs leading-none">
                  <MatrixReveal text={d.sticker.code} duration={550} />
                </div>
                <div class="text-[9px] text-ink-300 truncate w-full text-center">
                  {d.sticker.team || d.sticker.section || ''}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

  <!-- REVIEW -->
  {:else if stage === 'review'}
    <div class="px-5 space-y-3">
      {#if imageUrl}
        <div class="card p-2">
          <button type="button" onclick={() => (lightboxOpen = true)}
                  class="block w-full appearance-none p-0 bg-transparent border-0 cursor-zoom-in">
            <ScanOverlay imageUrl={imageUrl} scanning={false}
                         bboxes={[
                           ...detected.map((d) => ({ id: d.id, bbox: d.bbox, status: d.status })),
                           ...tentatives.map((t) => ({ id: t.id, bbox: t.bbox, status: 'tentative' })),
                         ]} />
          </button>
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-400 text-center mt-2">
            {detected.length} código{detected.length === 1 ? '' : 's'}
            {#if tentatives.length > 0} · {tentatives.length} possíve{tentatives.length === 1 ? 'l' : 'is'}{/if}
            · {ocrEngine}
          </div>
          {#if ocrDebug}
            <details class="mt-2 text-[10px] text-ink-400">
              <summary class="cursor-pointer underline">debug</summary>
              <pre class="mono mt-1 whitespace-pre-wrap break-all">{JSON.stringify(ocrDebug, null, 2)}</pre>
            </details>
          {/if}
        </div>
      {/if}

      {#if tentatives.length > 0}
        {@const selectedCount = tentatives.filter((t) => t.selected).length}
        <div class="card p-3 space-y-2 border border-gold-400/30">
          <div class="flex items-center justify-between">
            <div class="text-[10px] uppercase tracking-[0.18em] text-gold-400">
              possíveis ({tentatives.length}) — circuladas na foto
            </div>
            <button type="button"
                    onclick={() => selectAllTentatives(selectedCount !== tentatives.length)}
                    class="text-[10px] underline text-ink-300">
              {selectedCount === tentatives.length ? 'limpar' : 'todas'}
            </button>
          </div>
          <p class="text-[11px] text-ink-300">
            Selecione as que parecem cromos e toque <strong class="text-gold-400">reanalisar selecionadas</strong>. A IA roda OCR pesado em cada região — se identificar, vira card verde.
          </p>
          <div class="grid grid-cols-2 gap-2">
            {#each tentatives as t (t.id)}
              <label class="rounded-lg border p-2 transition flex items-center gap-2 cursor-pointer
                            {t.failed
                              ? 'border-flag-500/40 bg-flag-500/5'
                              : t.selected
                                ? 'border-gold-400/60 bg-gold-400/10'
                                : 'border-white/10 bg-white/[0.03]'}">
                <input type="checkbox" class="shrink-0 h-4 w-4 accent-gold-400"
                       checked={t.selected} disabled={t.loading}
                       onchange={() => toggleTentativeSelect(t.id)} />
                <BboxCrop imageUrl={imageUrl} bbox={t.bbox} size={44} scanning={t.loading} />
                <div class="min-w-0 flex-1">
                  <div class="mono text-[11px] text-ink-200 truncate">"{t.raw_text}"</div>
                  <div class="text-[9px] mt-0.5"
                       class:text-gold-400={!t.loading && !t.failed}
                       class:text-flag-400={t.failed}
                       class:text-ink-300={t.loading}>
                    {#if t.loading}
                      analisando…
                    {:else if t.failed}
                      não identifiquei
                    {:else}
                      pronta pra reanalisar
                    {/if}
                  </div>
                </div>
              </label>
            {/each}
          </div>
          {#if selectedCount > 0}
            <button type="button"
                    onclick={reanalyzeSelectedTentatives}
                    disabled={tentatives.some((t) => t.loading)}
                    class="w-full rounded-xl bg-gold-400 py-2.5 text-sm font-semibold text-[#050b1f]
                           active:scale-[0.99] transition disabled:opacity-50">
              ✨ reanalisar {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
            </button>
          {/if}
        </div>
      {/if}

      {#if detected.length > 0}
        <div class="card p-3 space-y-2">
          <div class="text-[10px] uppercase tracking-[0.18em] text-ink-300">confira o que foi lido</div>
          {#each detected as d (d.id)}
            {@const mcCapable = hasMCVariant(d.sticker)}
            {@const owned = ownedFor(d)}
            <div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <button type="button"
                      class="h-7 w-7 grid place-items-center rounded-md border-2 shrink-0
                             {d.confirmed ? 'bg-pitch-400 border-pitch-400 text-ink-950' : 'border-white/20 text-transparent'}"
                      aria-label="confirmar"
                      onclick={() => toggleConfirm(d.id)}>✓</button>
              {#if d.bbox && imageUrl}
                <BboxCrop imageUrl={imageUrl} bbox={d.bbox} size={40} scanning={false} />
              {/if}
              <div class="flex-1 min-w-0">
                <div class="display text-base font-bold text-white leading-none flex items-center gap-2">
                  <span>{d.variant === 'mc' ? `${d.sticker.team} 13 (MC)` : formatStickerLabel(d.sticker)}</span>
                  {#if owned === 0}
                    <span class="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-pitch-400/20 text-pitch-400">nova</span>
                  {:else}
                    <span class="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold-400/15 text-gold-400">×{owned} tenho</span>
                  {/if}
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
              <div class="shrink-0 flex flex-col items-end gap-0.5">
                <span class="text-[10px] mono
                             {d.votes >= 6 ? 'text-pitch-400' : d.votes >= 3 ? 'text-gold-400' : 'text-ink-400'}">
                  {d.votes}×
                </span>
                {#if d.votes >= 6}
                  <span class="text-[9px] text-pitch-400 uppercase">certo</span>
                {:else if d.votes >= 3}
                  <span class="text-[9px] text-gold-400 uppercase">alta</span>
                {:else if d.votes === 2}
                  <span class="text-[9px] text-ink-300 uppercase">média</span>
                {:else}
                  <span class="text-[9px] text-ink-400 uppercase">revisar</span>
                {/if}
              </div>
              <div class="shrink-0 flex flex-row gap-1">
                <button class="h-7 w-7 grid place-items-center rounded-md border border-white/10 bg-white/[0.04] text-ink-300 hover:text-white hover:border-white/20"
                        onclick={() => openEdit(d)} type="button" aria-label="corrigir código" title="código errado?">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="h-7 w-7 grid place-items-center rounded-md border border-flag-500/30 bg-flag-500/10 text-flag-400 hover:bg-flag-500/20"
                        onclick={() => reportFalsePositive(d)} type="button" aria-label="não era essa">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
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
            <div class="text-xs text-ink-300 mt-0.5">Registra cada figurinha: inéditas vão pro álbum, conhecidas vão pro bolo de repetidas</div>
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
      {#if destination === 'received' || destination === 'given'}
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

<!-- FEEDBACK: edit-code modal -->
{#if editingDetected}
  <div class="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center"
       onclick={closeEdit}>
    <div class="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0a1230] p-5 space-y-3"
         onclick={(e) => e.stopPropagation()}>
      <div>
        <h2 class="text-base font-semibold text-white">Corrigir código</h2>
        <p class="text-xs text-ink-300 mt-1">
          A IA leu como <strong class="mono text-flag-400">{editingDetected.sticker.code}</strong>. Qual é o código correto? Vai pro nosso dataset pra melhorar o modelo.
        </p>
      </div>
      {#if editingDetected.bbox && imageUrl}
        <div class="flex justify-center">
          <BboxCrop imageUrl={imageUrl} bbox={editingDetected.bbox} size={96} scanning={false} />
        </div>
      {/if}
      <input type="text"
             bind:value={editValue}
             autocapitalize="characters" spellcheck="false" autocomplete="off"
             placeholder="ex: BRA17"
             class="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-3 mono text-base text-ink-200 placeholder:text-ink-400/50 focus:outline-none focus:ring-2 focus:ring-gold-400/60" />
      <div class="flex gap-2">
        <button type="button" onclick={closeEdit}
                class="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-ink-300">
          cancelar
        </button>
        <button type="button" onclick={submitCorrection}
                disabled={editSubmitting || !editValue.trim()}
                class="flex-1 rounded-lg bg-gold-400 py-2.5 text-sm font-semibold text-[#050b1f] disabled:opacity-50">
          {editSubmitting ? 'salvando…' : 'salvar correção'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Toast for feedback / corrections -->
{#if toastMsg}
  <div class="fixed top-[max(1rem,var(--safe-top))] left-1/2 -translate-x-1/2 z-[90]
              rounded-full bg-pitch-500/95 text-white text-xs font-medium px-4 py-2
              animate-[fadein_0.2s_ease-out] pointer-events-none">
    {toastMsg}
  </div>
{/if}

<!-- LIGHTBOX — top-level. Zoom uses real width sizing (not transform: scale)
     so the container's overflow-auto produces real scroll/pan in 2× and 3×. -->
{#if lightboxOpen && imageUrl}
  <div role="dialog" aria-modal="true"
       class="fixed inset-0 z-[70] bg-black overflow-auto"
       onclick={() => {
         if (lightboxScanLoading) return;
         if (lightboxScanMode || pendingMarks.length > 0) return; // don't close mid-marking
         lightboxOpen = false; lightboxZoom = 1;
       }}>
    <!-- Photo wrapper grows with zoom (100/200/300 vw) so overflow-auto pans
         naturally. Tap inside adds a pending mark when in scan mode. -->
    <div class="min-h-dvh flex items-center justify-center"
         style="width:{lightboxZoom * 100}vw;"
         onclick={(e) => {
           e.stopPropagation();
           if (lightboxScanMode && !lightboxScanLoading) {
             addMark(e.clientX, e.clientY, e.currentTarget);
           }
         }}>
      <div class="relative" style="line-height:0;">
        <ScanOverlay imageUrl={imageUrl} scanning={false}
                     imgClass="w-full h-auto {lightboxScanMode ? 'cursor-crosshair' : ''}"
                     bboxes={[
                       ...detected.map((d) => ({ id: d.id, bbox: d.bbox, status: d.status })),
                       ...tentatives.map((t) => ({ id: t.id, bbox: t.bbox, status: 'tentative' })),
                     ]} />
        <!-- Pending tap marks overlay (user marked, not yet analyzed) -->
        {#each pendingMarks as m (m.id)}
          {@const xs = m.bbox.map((p) => p[0])}
          {@const ys = m.bbox.map((p) => p[1])}
          {@const x0 = Math.min(...xs)}
          {@const y0 = Math.min(...ys)}
          {@const w = Math.max(...xs) - x0}
          {@const h = Math.max(...ys) - y0}
          <div class="absolute pointer-events-none flex items-center justify-center
                      animate-[fadein_0.2s_ease-out]"
               style="left:{x0*100}%;top:{y0*100}%;width:{w*100}%;height:{h*100}%;">
            <div class="absolute inset-0 rounded-full border-2
                        {m.status === 'loading' ? 'border-gold-400 animate-pulse'
                          : m.status === 'done' ? 'border-pitch-400'
                          : m.status === 'failed' ? 'border-flag-500 border-dashed'
                          : 'border-sky26-400 border-dashed'}"
                 style="box-shadow: 0 0 8px currentColor;"></div>
            <span class="relative text-xs font-bold text-white drop-shadow-lg"
                  style="text-shadow: 0 0 4px black;">
              {m.status === 'loading' ? '…' : m.status === 'done' ? '✓' : m.status === 'failed' ? '✗' : '+'}
            </span>
          </div>
        {/each}
      </div>
    </div>

    <!-- TOP RIGHT: close -->
    <button type="button" aria-label="fechar"
            onclick={(e) => { e.stopPropagation(); lightboxOpen = false; lightboxScanMode = false; lightboxZoom = 1; clearMarks(); }}
            class="fixed top-[max(0.75rem,var(--safe-top))] right-3 grid place-items-center
                   h-10 w-10 rounded-full bg-white/15 text-white border border-white/25
                   active:scale-95 transition z-[71]"
            style="backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>

    <!-- TOP LEFT: zoom toggle -->
    <button type="button"
            onclick={(e) => { e.stopPropagation(); lightboxZoom = lightboxZoom >= 3 ? 1 : lightboxZoom + 1; }}
            class="fixed top-[max(0.75rem,var(--safe-top))] left-3 grid place-items-center
                   h-10 px-3 rounded-full bg-white/15 text-white border border-white/25 text-xs font-bold
                   active:scale-95 transition z-[71]"
            style="backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
      {lightboxZoom}×
    </button>

    <!-- BOTTOM: scan-mode toggle + batch analyze -->
    <div class="fixed bottom-[max(1rem,var(--safe-bottom))] left-1/2 -translate-x-1/2 z-[71]
                flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      {#if lightboxScanError}
        <span class="rounded-full bg-flag-500/90 text-white text-xs font-medium px-3 py-1.5 pointer-events-auto">
          {lightboxScanError}
        </span>
      {/if}
      {#if lightboxScanLoading && lightboxBatchProgress}
        <span class="rounded-full bg-pitch-500/90 text-white text-xs font-medium px-3 py-1.5 pointer-events-auto">
          analisando {lightboxBatchProgress.done + 1} de {lightboxBatchProgress.total}…
        </span>
      {:else if lightboxScanMode}
        <div class="flex items-center gap-2 pointer-events-auto">
          {#if pendingMarks.length > 0}
            <button type="button"
                    onclick={(e) => { e.stopPropagation(); analyzePendingMarks(); }}
                    class="rounded-full px-4 py-2 text-xs font-semibold bg-gold-400 text-[#050b1f]
                           active:scale-95 transition">
              ✨ analisar {pendingMarks.length} {pendingMarks.length === 1 ? 'marcada' : 'marcadas'}
            </button>
            <button type="button"
                    onclick={(e) => { e.stopPropagation(); clearMarks(); }}
                    class="rounded-full h-10 w-10 grid place-items-center bg-white/15 text-white
                           border border-white/25 active:scale-95 transition"
                    style="backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);"
                    aria-label="limpar marcações">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          {:else}
            <button type="button"
                    onclick={(e) => { e.stopPropagation(); lightboxScanMode = false; }}
                    class="rounded-full px-4 py-2 text-xs font-medium bg-sky26-500 text-white
                           border border-sky26-400 active:scale-95 transition">
              toca onde a IA esqueceu — sair
            </button>
          {/if}
        </div>
        {#if pendingMarks.length === 0}
          <p class="text-[11px] text-ink-300 text-center pointer-events-none">
            toca em quantas regiões quiser, depois analisa todas de uma vez
          </p>
        {/if}
      {:else}
        <button type="button"
                onclick={(e) => { e.stopPropagation(); lightboxScanMode = true; lightboxScanError = ''; }}
                class="rounded-full px-4 py-2 text-xs font-medium border transition pointer-events-auto
                       bg-white/15 text-white border-white/25"
                style="backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
          ✨ marcar regiões manualmente
        </button>
      {/if}
    </div>
  </div>
{/if}
