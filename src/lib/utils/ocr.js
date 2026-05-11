// OCR client-side robusto:
//  1. converte qualquer imagem (incluindo HEIC do iPhone) pra canvas
//  2. redimensiona se for muito grande (Tesseract roda mal acima de ~2500px)
//  3. TextDetector nativo quando disponivel; fallback Tesseract.js via CDN
//
// Reporta progresso em 3 fases: prepare -> load (Tesseract) -> ocr.

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_DIM = 2200;     // qualquer lado maior que isso vira 2200 px

let tessLoadPromise = null;

function loadTesseract(onProgress) {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessLoadPromise) return tessLoadPromise;
  tessLoadPromise = new Promise((resolve, reject) => {
    if (typeof onProgress === 'function') onProgress('Baixando OCR (~2MB)…', 0);
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => {
      if (typeof onProgress === 'function') onProgress('OCR carregado', 100);
      if (window.Tesseract) resolve(window.Tesseract);
      else { tessLoadPromise = null; reject(new Error('Tesseract nao expos no window')); }
    };
    s.onerror = () => {
      tessLoadPromise = null;
      reject(new Error('Falha ao baixar OCR do CDN (verifica internet)'));
    };
    document.head.appendChild(s);
  });
  return tessLoadPromise;
}

// Le o file via Image() — caminho mais compativel (funciona com HEIC no iOS
// quando Safari decodifica). Aplica EXIF orientation implicitamente pela tag.
async function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não consegui ler essa imagem. Tente foto em JPG/PNG.'));
    };
    img.src = url;
  });
}

// Converte para canvas, redimensionando se passar de MAX_DIM.
function imageToCanvas(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Imagem sem dimensões — talvez formato não suportado.');
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas;
}

// API publica.
// onStage(stage, progress0to100)
//   stage: 'prepare' | 'load' | 'ocr'
export async function ocrImage(file, onStage) {
  const stage = (s, p) => { if (typeof onStage === 'function') onStage(s, p); };

  stage('prepare', 10);
  const img = await fileToImage(file);
  const canvas = imageToCanvas(img);
  stage('prepare', 100);

  // 1. TextDetector nativo (Chromium)
  if ('TextDetector' in window) {
    try {
      const detector = new window.TextDetector();
      stage('ocr', 50);
      const detections = await detector.detect(canvas);
      stage('ocr', 100);
      const text = detections.map((d) => d.rawValue || '').join(' ').trim();
      if (text) return { text, engine: 'native', dataUrl: canvas.toDataURL('image/jpeg', 0.85) };
    } catch {
      // segue pra Tesseract
    }
  }

  // 2. Tesseract.js
  let T;
  try {
    T = await loadTesseract((msg, p) => stage('load', p));
  } catch (err) {
    throw err;
  }

  stage('ocr', 0);
  let lastP = 0;
  const { data } = await T.recognize(canvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const p = Math.round((m.progress || 0) * 100);
        if (p > lastP) { lastP = p; stage('ocr', p); }
      } else if (m.status && m.status.startsWith('loading') && m.progress != null) {
        stage('load', Math.round(m.progress * 100));
      }
    },
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -'
  });
  stage('ocr', 100);
  return {
    text: data?.text || '',
    engine: 'tesseract',
    dataUrl: canvas.toDataURL('image/jpeg', 0.85)
  };
}

export function ocrAvailability() {
  return {
    native: typeof window !== 'undefined' && 'TextDetector' in window,
    fallbackUrl: TESSERACT_URL
  };
}
