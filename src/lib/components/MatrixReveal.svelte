<script>
  import { onMount, onDestroy } from 'svelte';

  let { text = '', duration = 600, className = '' } = $props();

  // Mix of Latin + Katakana for the matrix feel. Avoid lowercase since
  // we're settling on uppercase sticker codes.
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ';

  let display = $state('');
  let settled = $state(false);
  let timer;

  function randomChar() {
    return ALPHABET[(Math.random() * ALPHABET.length) | 0];
  }

  onMount(() => {
    const target = String(text);
    const len = target.length;
    if (len === 0) {
      display = '';
      settled = true;
      return;
    }
    const start = performance.now();
    const tickMs = 35;

    function frame() {
      const t = performance.now() - start;
      const progress = Math.min(1, t / duration);
      // Each character settles at a staggered time: leftmost first.
      let next = '';
      for (let i = 0; i < len; i++) {
        const settleAt = (i + 1) / (len + 1);
        if (progress >= settleAt) {
          next += target[i];
        } else {
          // Preserve spaces/punctuation so the layout doesn't jitter.
          const c = target[i];
          next += /[A-Z0-9]/i.test(c) ? randomChar() : c;
        }
      }
      display = next;
      if (progress >= 1) {
        settled = true;
        return;
      }
      timer = setTimeout(frame, tickMs);
    }
    frame();
  });

  onDestroy(() => clearTimeout(timer));
</script>

<span class="mono inline-flex font-bold tabular-nums tracking-wide {className}"
      class:text-pitch-400={settled}
      style="color: {settled ? '' : '#22c55e'}; text-shadow: {settled ? 'none' : '0 0 6px rgba(34,197,94,0.55)'}; transition: text-shadow 0.2s;">
  {display || text}
</span>
