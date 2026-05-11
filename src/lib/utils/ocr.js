// OCR client-side: PaddleOCR (via onnxruntime-web) como engine primario,
// Tesseract.js como fallback se algo travar. Validacao local mostrou que
// PaddleOCR pega 100% dos codigos em fotos cascade vs ~10% do Tesseract.
//
// Pipeline:
//   1. converte qualquer imagem (incluindo HEIC do iPhone) pra canvas
//   2. redimensiona pra ate 1800px (PaddleOCR funciona bem em resolucao moderada)
//   3. roda PaddleOCR. Se < 3 deteccoes, roda tambem com rotacao 90°.
//   4. uniao dos resultados
//
// Stages reportados: prepare -> load -> ocr.

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_DIM = 1800;

let paddlePromise = null;
let tessLoadPromise = null;

// --- PaddleOCR ---

async function loadPaddle(onStage) {
  if (paddlePromise) return paddlePromise;
  paddlePromise = (async () => {
    if (typeof onStage === 'function') onStage('load', 5);
    const { default: Ocr } = await import('@gutenye/ocr-browser');
    if (typeof onStage === 'function') onStage('load', 30);
    const ocr = await Ocr.create({
      models: {
        detectionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_det_infer.onnx',
        recognitionPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ch_PP-OCRv4_rec_infer.onnx',
        dictionaryPath: 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1/assets/ppocr_keys_v1.txt'
      }
    });
    if (typeof onStage === 'function') onStage('load', 100);
    return ocr;
  })();
  paddlePromise.catch(() => { paddlePromise = null; });
  return paddlePromise;
}

export function prewarmPaddleOCR() {
  loadPaddle().catch((e) => console.warn('paddle prewarm failed:', e?.message));
}

// --- Tesseract fallback ---

function loadTesseract(onStage) {
  if (typeof window === 'undefined') return Promise.reject(new Error('sem window'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessLoadPromise) return tessLoadPromise;
  tessLoadPromise = new Promise((resolve, reject) => {
    if (typeof onStage === 'function') onStage('load', 0);
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else { tessLoadPromise = null; reject(new Error('Tesseract nao expos')); }
    };
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
  // canvas dimensions levam em conta a rotacao
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

// --- API publica ---

// onStage(stage, progress) — stage: 'prepare'|'load'|'ocr'
export async function ocrImage(file, onStage) {
  const stage = (s, p) => { if (typeof onStage === 'function') onStage(s, p); };

  stage('prepare', 10);
  const img = await fileToImage(file);
  stage('prepare', 100);

  // 1. Tenta PaddleOCR (primario)
  try {
    const ocr = await loadPaddle((s, p) => stage(s, p));
    stage('ocr', 10);
    const baseCanvas = imageToCanvas(img, 0);
    const blob0 = await canvasToBlob(baseCanvas);
    const lines0 = await ocr.detect(blob0);
    stage('ocr', 50);

    // se achar pouco, complementa com rotacao 90°
    let lines = lines0.slice();
    if (extractCodeCount(lines0) < 3) {
      const r90 = imageToCanvas(img, 90);
      const blob90 = await canvasToBlob(r90);
      const lines90 = await ocr.detect(blob90);
      lines = lines.concat(lines90);
    }
    stage('ocr', 100);

    const text = lines.map((l) => l.text || '').join('\n');
    return { text, engine: 'paddleocr', dataUrl: baseCanvas.toDataURL('image/jpeg', 0.85) };
  } catch (paddleErr) {
    console.warn('Paddle falhou, caindo pro Tesseract:', paddleErr?.message);
  }

  // 2. Fallback: Tesseract
  const T = await loadTesseract(stage);
  const fallbackCanvas = imageToCanvas(img, 0);
  stage('ocr', 0);
  const { data } = await T.recognize(fallbackCanvas, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') stage('ocr', Math.round((m.progress || 0) * 100));
    },
    tessedit_pageseg_mode: '11'
  });
  stage('ocr', 100);
  return {
    text: data?.text || '',
    engine: 'tesseract',
    dataUrl: fallbackCanvas.toDataURL('image/jpeg', 0.85)
  };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('canvas->blob fail')), 'image/jpeg', 0.92)
  );
}

// Heuristic: conta quantos candidatos a codigo de figurinha aparecem no texto.
// Usado pra decidir se vale rodar uma segunda rotacao.
function extractCodeCount(lines) {
  let n = 0;
  for (const l of lines) {
    if (!l.text) continue;
    const m = l.text.match(/\b[A-Z]{2,5}[\s\-]?\d{1,2}\b/g);
    if (m) n += m.length;
  }
  return n;
}

export function ocrAvailability() {
  return {
    paddle: true,
    fallback: 'tesseract.js'
  };
}
