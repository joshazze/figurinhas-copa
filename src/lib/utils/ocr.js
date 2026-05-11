// OCR client-side com diagnostico explicito.
// Antes: catch silencioso engolia erros e caia pro Tesseract sem avisar.
// Agora: erro do Paddle SOBE pra UI mostrar pro user; debug info exposto.

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_DIM = 3200;

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

function imageToCanvas(img, rotate = 0) {
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
// Tenta PaddleOCR. Em caso de erro, SOBE pro caller. Caller decide se quer
// pedir fallback Tesseract manualmente via ocrTesseract().
export async function ocrPaddle(file, onUpdate) {
  const update = (phase, percent) => onUpdate?.({ phase, percent });
  const debug = { engine: 'paddleocr', timings: {} };

  update('prepare');
  const t0 = Date.now();
  const img = await fileToImage(file);
  debug.timings.decode = Date.now() - t0;
  debug.imgSize = { w: img.naturalWidth, h: img.naturalHeight };

  const t1 = Date.now();
  const ocr = await loadPaddle((phase) => update(phase));
  debug.timings.load = Date.now() - t1;

  update('ocr', 5);
  const c0 = imageToCanvas(img, 0);
  const c90 = imageToCanvas(img, 90);
  debug.canvasSize = { w0: c0.width, h0: c0.height, w90: c90.width, h90: c90.height };
  const [b0, b90] = await Promise.all([canvasToBlob(c0), canvasToBlob(c90)]);
  // BUG FIX: @gutenye/ocr-browser usa `image.src = url` internamente.
  // Precisa ser URL string, NAO Blob. Sem isso, decode() rejeita silencioso
  // e detect() retorna [] sem erro visivel.
  const u0 = URL.createObjectURL(b0);
  const u90 = URL.createObjectURL(b90);
  update('ocr', 25);

  const t2 = Date.now();
  let lines0 = [], lines90 = [];
  const errors = [];
  try { lines0 = await ocr.detect(u0); } catch (e) { errors.push({ rot: 0, error: e?.message || String(e) }); }
  update('ocr', 65);
  try { lines90 = await ocr.detect(u90); } catch (e) { errors.push({ rot: 90, error: e?.message || String(e) }); }
  URL.revokeObjectURL(u0);
  URL.revokeObjectURL(u90);
  debug.timings.detect = Date.now() - t2;
  debug.detections = { rot0: lines0?.length || 0, rot90: lines90?.length || 0 };
  if (errors.length > 0) debug.errors = errors;

  update('ocr', 100);
  const lines = [...(lines0 || []), ...(lines90 || [])];
  const text = lines.map((l) => l.text || '').join('\n');

  return {
    text,
    engine: 'paddleocr',
    dataUrl: c0.toDataURL('image/jpeg', 0.85),
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
