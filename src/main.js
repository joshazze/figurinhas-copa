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

const app = mount(App, { target: document.getElementById('app') });
export default app;
