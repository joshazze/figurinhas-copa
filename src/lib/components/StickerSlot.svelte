<script>
  import { appState, setStickerCount, addSticker } from '../stores/appState.svelte.js';

  let { sticker } = $props();

  const count = $derived(appState.collected[sticker.code] || 0);
  const have = $derived(count > 0);
  const dup = $derived(count > 1);
  const display = $derived(sticker.label || sticker.code);

  let pressTimer = null;

  function tap() {
    if (have) {
      // Incrementa repetida ate 9, depois zera
      if (count >= 9) setStickerCount(sticker.code, 0);
      else addSticker(sticker.code, 1);
    } else {
      setStickerCount(sticker.code, 1);
    }
  }

  function pressStart() {
    pressTimer = setTimeout(() => {
      // Long press: zera
      setStickerCount(sticker.code, 0);
      pressTimer = null;
    }, 450);
  }
  function pressEnd() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
      tap();
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
