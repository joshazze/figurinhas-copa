// OCR client-side: PaddleOCR via @gutenye/ocr-browser (ONNX runtime).
// Aprendizados validados nas fotos do user:
//  - resize agressivo MATA a precisao em foto de longe (cascade). Cap em 3200px
//    so pra evitar memoria estourar; abaixo disso, passa full-res.
//  - rotacao 90° e crucial em fotos cascade (a maioria). Roda 0° + 90° em paralelo.
//
// Fallback: Tesseract.js (cdn lazy).

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_DIM = 3200;    // so corta se a foto for absurdamente grande

let paddlePromise = null;
let tessLoadPromise = null;

// --- PaddleOCR ---

async function loadPaddle(onPhase) {
  if (paddlePromise) return paddlePromise;
  paddlePromise = (async () => {
    onPhase?.('engine');
    const { default: Ocr } = await import('@gutenye/ocr-browser');
    onPhase?.('models');
    const ocr = await Ocr.create({
      models: {
        detectionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_det_infer.onnx',
        recognitionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_rec_infer.onnx',
        dictionaryPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ppocr_keys_v1.txt'
      }
    });
    onPhase?.('ready');
    return ocr;
  })();
  paddlePromise.catch(() => { paddlePromise = null; });
  return paddlePromise;
}

export function prewarmPaddleOCR() {
  loadPaddle().catch((e) => console.warn('paddle prewarm failed:', e?.message));
}

// --- Tesseract fallback ---

function loadTesseract() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
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
      reject(new Error('Não consegui ler essa imagem. Tente JPG/PNG.'));
    };
    img.src = url;
  });
}

function imageToCanvas(img, rotate = 0) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Imagem sem dimensões.');
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
// onUpdate({ phase, percent? }) — phase: 'prepare' | 'engine' | 'models' | 'ocr' | 'ready'
//   percent so existe em 'ocr' (durante recognize)
export async function ocrImage(file, onUpdate) {
  const update = (phase, percent) => onUpdate?.({ phase, percent });

  update('prepare');
  const img = await fileToImage(file);

  // 1. Tenta PaddleOCR
  try {
    const ocr = await loadPaddle((phase) => update(phase));
    update('ocr', 5);

    // canvases (0° e 90°) em paralelo. 90° pega cascade typical orientation.
    const c0 = imageToCanvas(img, 0);
    const c90 = imageToCanvas(img, 90);
    const [b0, b90] = await Promise.all([canvasToBlob(c0), canvasToBlob(c90)]);

    update('ocr', 25);
    const [lines0, lines90] = await Promise.all([
      ocr.detect(b0).catch(() => []),
      ocr.detect(b90).catch(() => [])
    ]);
    update('ocr', 95);

    const lines = [...(lines0 || []), ...(lines90 || [])];
    const text = lines.map((l) => l.text || '').join('\n');
    update('ocr', 100);
    return {
      text,
      engine: 'paddleocr',
      dataUrl: c0.toDataURL('image/jpeg', 0.85)
    };
  } catch (paddleErr) {
    console.warn('Paddle falhou, fallback Tesseract:', paddleErr?.message);
  }

  // 2. Fallback Tesseract
  const T = await loadTesseract();
  const fallbackCanvas = imageToCanvas(img, 0);
  update('ocr', 0);
  const { data } = await T.recognize(fallbackCanvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') update('ocr', Math.round((m.progress || 0) * 100));
    },
    tessedit_pageseg_mode: '11'
  });
  update('ocr', 100);
  return {
    text: data?.text || '',
    engine: 'tesseract',
    dataUrl: fallbackCanvas.toDataURL('image/jpeg', 0.85)
  };
}

export function ocrAvailability() {
  return { paddle: true, fallback: 'tesseract.js' };
}
