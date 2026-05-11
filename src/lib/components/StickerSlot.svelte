<script>
  import { appState, setStickerCount, addSticker } from '../stores/appState.svelte.js';

  // onOpen: callback opcional. Quando fornecido, qualquer interacao (tap OU long-press)
  // abre o menu de acoes da figurinha. Sem callback, o comportamento legado e mantido
  // (tap incrementa, long-press zera).
  let { sticker, onOpen = null } = $props();

  const count = $derived(appState.collected[sticker.code] || 0);
  const have = $derived(count > 0);
  const dup = $derived(count > 1);
  const display = $derived(sticker.label || sticker.code);

  let pressTimer = null;
  let longPressFired = false;

  function legacyTap() {
    if (have) {
      if (count >= 9) setStickerCount(sticker.code, 0);
      else addSticker(sticker.code, 1);
    } else {
      setStickerCount(sticker.code, 1);
    }
  }

  function pressStart() {
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      pressTimer = null;
      if (typeof onOpen === 'function') onOpen(sticker);
      else setStickerCount(sticker.code, 0);    // legacy: zera
    }, 450);
  }

  function pressEnd() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      if (typeof onOpen === 'function') onOpen(sticker);
      else legacyTap();
    }
  }

  function pressCancel() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  }
</script>

<button
  type="button"
  class="slot {have ? 'have' : ''} {dup ? 'dup' : ''} {sticker.special ? 'special' : ''}"
  onpointerdown={pressStart}
  onpointerup={pressEnd}
  onpointerleave={pressCancel}
  onpointercancel={pressCancel}
  oncontextmenu={(e) => e.preventDefault()}
  aria-label={`${display} — ${sticker.name}${have ? ` (tem ${count})` : ''}`}
>
  <div class="flex flex-col items-center gap-0.5 select-none pointer-events-none">
    <div class="mono text-[10px] leading-none">{display}</div>
    {#if dup}
      <div class="mt-1 px-1.5 py-0.5 rounded-full bg-sun-400 text-ink-950 text-[9px] font-bold leading-none">
        ×{count}
      </div>
    {/if}
  </div>
</button>
