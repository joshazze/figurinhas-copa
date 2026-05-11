// OCR client-side com diagnostico explicito.
// Antes: catch silencioso engolia erros e caia pro Tesseract sem avisar.
// Agora: erro do Paddle SOBE pra UI mostrar pro user; debug info exposto.

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_DIM = 2000;      // mantem detalhe legivel sem encher RAM no iPhone
const THUMB_DIM = 900;     // canvas separado pequeno pra preview na review

let paddlePromise = null;
let tessLoadPromise = null;

export class OCRError extends Error {
  constructor(message, cause, debug) {
    super(message);
    this.cause = cause;
    this.debug = debug;
  }
}

// --- PaddleOCR ---

async function loadPaddle(onPhase) {
  if (paddlePromise) return paddlePromise;
  paddlePromise = (async () => {
    onPhase?.('engine');
    let modBrowser;
    try {
      modBrowser = await import('@gutenye/ocr-browser');
    } catch (e) {
      throw new OCRError('Falha ao baixar engine OCR', e, { phase: 'engine' });
    }
    const Ocr = modBrowser.default;
    onPhase?.('models');
    try {
      const ocr = await Ocr.create({
        models: {
          detectionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_det_infer.onnx',
          recognitionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_rec_infer.onnx',
          dictionaryPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ppocr_keys_v1.txt'
        }
      });
      onPhase?.('ready');
      return ocr;
    } catch (e) {
      throw new OCRError('Falha ao carregar modelos PaddleOCR', e, { phase: 'models' });
    }
  })();
  paddlePromise.catch(() => { paddlePromise = null; });
  return paddlePromise;
}

export function prewarmPaddleOCR() {
  loadPaddle().catch((e) => console.warn('[OCR prewarm]', e?.message, e?.cause));
}

// --- Tesseract fallback (manual, so quando user pedir) ---

async function loadTesseract() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.Tesseract) return window.Tesseract;
  if (tessLoadPromise) return tessLoadPromise;
  tessLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Tesseract nao expos'));
    s.onerror = () => { tessLoadPromise = null; reject(new Error('Falha CDN Tesseract')); };
    document.head.appendChild(s);
  });
  return tessLoadPromise;
}

// --- Image prep ---

async function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new OCRError('Não consegui ler essa imagem. Tente JPG/PNG.', null, { phase: 'decode' }));
    };
    img.src = url;
  });
}

function imageToCanvas(img, rotate = 0, filter = null) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new OCRError('Imagem sem dimensões.', null, {});
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);
  const rotated = rotate === 90 || rotate === 270;
  const cw = rotated ? sh : sw;
  const ch = rotated ? sw : sh;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (filter) ctx.filter = filter;       // CSS filter: contrast(1.4) saturate(0.4) etc.
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return canvas;
}

function canvasToBlob(canvas, quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('canvas->blob fail')), 'image/jpeg', quality)
  );
}

// --- API publica ---
// onUpdate({ phase, percent? }) — phase: 'prepare' | 'engine' | 'models' | 'ready' | 'ocr'
//
// Multi-pass voting: roda OCR em varias versoes da MESMA imagem (rotacao +
// variacao de contraste/sharpness) e agrega resultados. Codigo que aparece em
// 2+ passes = alta confianca; 1 pass = baixa (user revisa).
//
// Passes definidos (ordem importa pra short-circuit):
//   1. 0°    sem filtro       (referencia)
//   2. 90°   sem filtro       (cascade orientation)
//   3. 0°    contraste 1.4    (badge ficou claro?)
//   4. 90°   contraste 1.4    (idem rotacionado)
//
// Cada pass libera blob/url logo depois pra nao acumular memoria no iPhone.
export async function ocrPaddle(file, onUpdate) {
  const update = (phase, percent) => onUpdate?.({ phase, percent });
  const debug = { engine: 'paddleocr', timings: {}, passes: [] };

  update('prepare');
  const t0 = Date.now();
  const img = await fileToImage(file);
  debug.timings.decode = Date.now() - t0;
  debug.imgSize = { w: img.naturalWidth, h: img.naturalHeight };

  const tLoad = Date.now();
  const ocr = await loadPaddle((phase) => update(phase));
  debug.timings.load = Date.now() - tLoad;

  // 7 passes Paddle cobrindo todas as orientacoes + niveis de contraste.
  // + 1 pass Tesseract no final como "segunda opiniao" de engine diferente.
  // Total 8 fontes -> codigo em 3+ = alta confianca; 2 = media; 1 = baixa.
  const passes = [
    { name: '0°',           rotate: 0,   filter: null },
    { name: '90°',          rotate: 90,  filter: null },
    { name: '180°',         rotate: 180, filter: null },
    { name: '270°',         rotate: 270, filter: null },
    { name: '0°+contr',     rotate: 0,   filter: 'contrast(1.4) saturate(0.3) brightness(1.05)' },
    { name: '90°+contr',    rotate: 90,  filter: 'contrast(1.4) saturate(0.3) brightness(1.05)' },
    { name: '0°+grayHi',    rotate: 0,   filter: 'grayscale(1) contrast(1.8) brightness(1.1)' }
  ];

  // Confidence minimo do PaddleOCR (cada linha vem com .score 0-1).
  const MIN_SCORE = 0.55;

  // Thumb pequeno pra preview da review — gerado ANTES dos passes pra poder
  // liberar a img full-res caso necessario.
  const thumbCanvas = imageToCanvas(img, 0);
  // Reduz thumb pra dataUrl ocupar pouca memoria
  let thumbDataUrl;
  {
    const tw = thumbCanvas.width, th = thumbCanvas.height;
    const tscale = Math.min(1, THUMB_DIM / Math.max(tw, th));
    const tc = document.createElement('canvas');
    tc.width = Math.round(tw * tscale);
    tc.height = Math.round(th * tscale);
    tc.getContext('2d').drawImage(thumbCanvas, 0, 0, tc.width, tc.height);
    thumbDataUrl = tc.toDataURL('image/jpeg', 0.78);
    tc.width = 0; tc.height = 0;
    thumbCanvas.width = 0; thumbCanvas.height = 0;
  }

  const allLines = [];
  const tDetect = Date.now();

  for (let i = 0; i < passes.length; i++) {
    const p = passes[i];
    update('ocr', 10 + Math.round((i / passes.length) * 85));
    const tPass = Date.now();

    // Cria, processa e LIBERA canvas/blob/url dentro do mesmo bloco
    let canvas, blob, url, lines = [], err = null;
    try {
      canvas = imageToCanvas(img, p.rotate, p.filter);
      blob = await canvasToBlob(canvas, 0.92);
      // libera canvas IMEDIATAMENTE — blob ja tem os bytes
      canvas.width = 0; canvas.height = 0;
      canvas = null;
      url = URL.createObjectURL(blob);
      blob = null;     // url segura referencia interna
      lines = await ocr.detect(url);
    } catch (e) {
      err = e?.message || String(e);
    } finally {
      if (url) URL.revokeObjectURL(url);
      url = null;
    }

    // Filtra linhas de baixa confidence do proprio Paddle
    const filtered = (lines || []).filter((l) => (l.score == null) || l.score >= MIN_SCORE);
    debug.passes.push({
      pass: p.name,
      lines: filtered.length,
      rawLines: lines?.length || 0,
      ms: Date.now() - tPass,
      err
    });
    if (filtered.length > 0) {
      for (const l of filtered) allLines.push({ ...l, pass: p.name });
    }

    // pausa breve permite o navegador respirar/coletar lixo entre passes
    await new Promise((r) => setTimeout(r, 50));
  }

  // 8º pass: Tesseract como segunda opiniao de engine diferente.
  // Codigos achados por AMBOS engines tem confianca maxima.
  try {
    const tTess = Date.now();
    const T = await loadTesseract();
    const tessCanvas = imageToCanvas(img, 0);
    const { data } = await T.recognize(tessCanvas, 'eng', {
      tessedit_pageseg_mode: '11'
    });
    tessCanvas.width = 0; tessCanvas.height = 0;
    const tessText = data?.text || '';
    if (tessText) {
      // simulamos uma "linha" Tesseract por linha de texto retornada
      for (const t of tessText.split('\n').map((s) => s.trim()).filter(Boolean)) {
        allLines.push({ text: t, pass: 'tesseract' });
      }
    }
    debug.passes.push({
      pass: 'tesseract',
      lines: tessText.split('\n').filter((s) => s.trim()).length,
      ms: Date.now() - tTess
    });
  } catch (e) {
    debug.passes.push({ pass: 'tesseract', lines: 0, err: e?.message || String(e) });
  }

  debug.timings.detect = Date.now() - tDetect;
  debug.totalLines = allLines.length;

  update('ocr', 100);
  const text = allLines.map((l) => l.text || '').join('\n');

  return {
    text,
    lines: allLines,        // pra multi-pass voting no codeMatch
    engine: 'paddleocr+tesseract',
    dataUrl: thumbDataUrl,
    debug
  };
}

// Fallback explicito quando user clicar "tentar com Tesseract"
export async function ocrTesseract(file, onUpdate) {
  const update = (phase, percent) => onUpdate?.({ phase, percent });
  const debug = { engine: 'tesseract', timings: {} };

  update('prepare');
  const img = await fileToImage(file);
  const t1 = Date.now();
  const T = await loadTesseract();
  debug.timings.load = Date.now() - t1;
  const canvas = imageToCanvas(img, 0);
  update('ocr', 0);
  const t2 = Date.now();
  const { data } = await T.recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') update('ocr', Math.round((m.progress || 0) * 100));
    },
    tessedit_pageseg_mode: '11'
  });
  debug.timings.recognize = Date.now() - t2;
  update('ocr', 100);
  return {
    text: data?.text || '',
    engine: 'tesseract',
    dataUrl: canvas.toDataURL('image/jpeg', 0.85),
    debug
  };
}

export function ocrAvailability() {
  return { paddle: true, fallback: 'tesseract.js' };
}
