import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// Quando o SW novo (com skipWaiting + clientsClaim) toma o controle,
// recarrega a aba pra puxar o index.html + chunks atualizados sem o user
// precisar fechar a PWA manualmente.
if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

// Clear the static fallback only when Svelte is about to mount.
const target = document.getElementById('app');
target.innerHTML = '';

let app;
try {
  app = mount(App, { target });
} catch (err) {
  // Last-resort: surface the error onscreen so the user gets actionable info
  // instead of a blank degradé.
  target.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif;background:#050b1f;color:#dde3f2;">
      <div style="color:#fbbf24;font-size:40px;font-weight:700;letter-spacing:0.04em;">FIGS</div>
      <p style="margin-top:24px;font-size:14px;color:#ef4444;">Erro ao iniciar o app.</p>
      <p style="margin-top:8px;font-size:12px;color:#9aa6cf;max-width:320px;word-break:break-word;">${(err && err.message || err)}</p>
      <a href="./recover.html" style="margin-top:32px;display:inline-block;background:#fbbf24;color:#050b1f;padding:10px 24px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none;">limpar cache e tentar de novo</a>
    </div>
  `;
  throw err;
}

export default app;
