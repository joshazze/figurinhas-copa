// OCR client-side: TextDetector nativo (Chromium) com fallback Tesseract.js (universal).
// Tesseract carregado sob demanda do CDN — nao entra no bundle principal.

const TESSERACT_URL = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';

let tessLoadPromise = null;

function loadTesseract() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessLoadPromise) return tessLoadPromise;
  tessLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.async = true;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => {
      tessLoadPromise = null;
      reject(new Error('falha ao carregar tesseract'));
    };
    document.head.appendChild(s);
  });
  return tessLoadPromise;
}

// Retorna o texto bruto detectado na imagem.
// onProgress: callback (0-100) recebido durante OCR Tesseract.
export async function ocrImage(file, onProgress) {
  if ('TextDetector' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new window.TextDetector();
      const detections = await detector.detect(bitmap);
      bitmap.close?.();
      const text = detections.map((d) => d.rawValue).join(' ');
      if (text.trim()) return { text, engine: 'native' };
    } catch {
      // segue pra Tesseract
    }
  }

  const T = await loadTesseract();
  const { data } = await T.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(Math.round((m.progress || 0) * 100));
      }
    },
    // Restringe o alfabeto pra reduzir falso-positivo
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -'
  });
  return { text: data.text || '', engine: 'tesseract' };
}

export function ocrAvailability() {
  return {
    native: typeof window !== 'undefined' && 'TextDetector' in window,
    fallbackUrl: TESSERACT_URL
  };
}
