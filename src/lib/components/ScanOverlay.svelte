<script>
  import { onMount, onDestroy } from 'svelte';

  // bboxes: [{bbox: [[x,y]...] in 0-1, status: 'verde'|'amarelo'|'tentative'}]
  // imgClass: extra Tailwind classes for the underlying <img> (e.g.
  // "max-h-[92vh] w-auto" in the lightbox so the photo fits the viewport).
  let { imageUrl, scanning = true, bboxes = [], imgClass = '' } = $props();

  // "Roaming reticle" — a crosshair that hops around the image every 600ms
  // while the scan is active. Pure JS state; no canvas.
  let reticle = $state({ x: 0.5, y: 0.5, opacity: 0 });
  let timer;

  function hop() {
    // Bias hops toward edges/grid so it doesn't sit in one place.
    reticle = {
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      opacity: 1,
    };
    timer = setTimeout(() => {
      reticle = { ...reticle, opacity: 0 };
      timer = setTimeout(hop, 200);
    }, 480);
  }

  onMount(() => {
    if (scanning) hop();
  });
  onDestroy(() => clearTimeout(timer));

  function bboxRect(bbox) {
    const xs = bbox.map((p) => p[0]);
    const ys = bbox.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    return {
      left: `${x0 * 100}%`,
      top: `${y0 * 100}%`,
      width: `${(x1 - x0) * 100}%`,
      height: `${(y1 - y0) * 100}%`,
    };
  }

  function bboxColor(status) {
    if (status === 'verde') return 'rgb(34 197 94)';     // pitch
    if (status === 'amarelo') return 'rgb(251 191 36)';  // gold
    return 'rgb(251 191 36)';                            // tentative = gold too
  }
</script>

<div class="scan-overlay-root relative inline-block">
  <img src={imageUrl} alt="" class="block w-full h-auto rounded-xl {imgClass}" />

  {#if scanning}
    <!-- Subtle grid pattern over the entire frame -->
    <div class="absolute inset-0 pointer-events-none scan-grid rounded-xl"></div>
    <!-- Vertical scan-line sweeping top-to-bottom -->
    <div class="absolute inset-0 pointer-events-none scan-line rounded-xl"></div>
    <!-- Top-left and bottom-right HUD brackets -->
    <div class="absolute inset-0 pointer-events-none scan-frame rounded-xl"></div>
    <!-- Roaming reticle hops to a new random position every ~700ms -->
    <div class="absolute pointer-events-none reticle"
         style="left:calc({reticle.x * 100}% - 14px); top:calc({reticle.y * 100}% - 14px); opacity:{reticle.opacity};"></div>
  {/if}

  <!-- Bbox markers — real detections from the stream.
       Confirmed: corner brackets (green or yellow).
       Tentative: pulsing circle (amber) — "AI couldn't read this for sure". -->
  {#each bboxes as b (b.id)}
    {@const r = bboxRect(b.bbox)}
    {#if b.status === 'tentative'}
      <div class="absolute pointer-events-none tentative-mark animate-[fadein_0.25s_ease-out]"
           style="left:{r.left};top:{r.top};width:{r.width};height:{r.height};">
        <div class="tentative-circle"></div>
        <div class="tentative-q">?</div>
      </div>
    {:else}
      <div class="absolute pointer-events-none bbox-mark animate-[fadein_0.25s_ease-out]"
           style="left:{r.left};top:{r.top};width:{r.width};height:{r.height};
                  --c:{bboxColor(b.status)};">
        <div class="bbox-corner tl"></div>
        <div class="bbox-corner tr"></div>
        <div class="bbox-corner bl"></div>
        <div class="bbox-corner br"></div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .scan-overlay-root img { user-select: none; -webkit-user-drag: none; }
  .scan-grid {
    background-image:
      linear-gradient(to right, rgba(34,197,94,0.10) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(34,197,94,0.10) 1px, transparent 1px);
    background-size: 24px 24px;
    mix-blend-mode: screen;
    animation: grid-shift 8s linear infinite;
  }
  @keyframes grid-shift {
    0%   { background-position: 0 0; }
    100% { background-position: 24px 24px; }
  }
  .scan-line {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(34,197,94,0.0) 42%,
      rgba(34,197,94,0.65) 50%,
      rgba(34,197,94,0.0) 58%,
      transparent 100%);
    background-size: 100% 240%;
    background-position: 0% 0%;
    mix-blend-mode: screen;
    animation: line-sweep 1.8s linear infinite;
  }
  @keyframes line-sweep {
    0%   { background-position: 0% -100%; }
    100% { background-position: 0% 200%; }
  }
  .scan-frame {
    --c: rgb(34 197 94);
    background:
      linear-gradient(var(--c), var(--c)) top left      / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top left      / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 2px 14px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 14px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 2px 14px no-repeat;
  }
  .reticle {
    width: 28px; height: 28px;
    border: 1px solid rgba(34,197,94,0.85);
    border-radius: 9999px;
    box-shadow: 0 0 12px rgba(34,197,94,0.55), inset 0 0 6px rgba(34,197,94,0.4);
    transition: left 0.5s cubic-bezier(.4,.2,.2,1),
                top  0.5s cubic-bezier(.4,.2,.2,1),
                opacity 0.25s linear;
  }
  .reticle::before, .reticle::after {
    content: ''; position: absolute; background: rgba(34,197,94,0.85);
  }
  .reticle::before { left: 50%; top: -6px; bottom: -6px; width: 1px; transform: translateX(-50%); }
  .reticle::after  { top: 50%; left: -6px; right: -6px; height: 1px; transform: translateY(-50%); }
  .bbox-mark { position: absolute; }
  .bbox-corner {
    position: absolute; width: 18px; height: 18px;
    border: 3px solid var(--c);
    box-shadow: 0 0 10px var(--c), inset 0 0 4px var(--c);
  }
  .bbox-corner.tl { top: -2px; left: -2px;  border-right: 0; border-bottom: 0; border-top-left-radius: 4px; }
  .bbox-corner.tr { top: -2px; right: -2px; border-left: 0;  border-bottom: 0; border-top-right-radius: 4px; }
  .bbox-corner.bl { bottom: -2px; left: -2px;  border-right: 0; border-top: 0; border-bottom-left-radius: 4px; }
  .bbox-corner.br { bottom: -2px; right: -2px; border-left: 0;  border-top: 0; border-bottom-right-radius: 4px; }

  /* Tentative: a pulsing amber circle stamped over the unread region. */
  .tentative-mark { display: grid; place-items: center; }
  .tentative-circle {
    position: absolute; inset: -4px;
    border: 2px dashed rgb(251 191 36);
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(251,191,36,0.55), inset 0 0 8px rgba(251,191,36,0.25);
    animation: tent-pulse 1.4s ease-in-out infinite;
  }
  .tentative-q {
    position: relative; color: rgb(251 191 36);
    font-weight: 700; font-size: 16px;
    text-shadow: 0 0 6px rgba(251,191,36,0.7);
    background: rgba(5,11,31,0.7);
    border-radius: 9999px;
    width: 22px; height: 22px;
    display: grid; place-items: center;
  }
  @keyframes tent-pulse {
    0%,100% { transform: scale(1);   opacity: 0.95; }
    50%     { transform: scale(1.08); opacity: 0.55; }
  }
</style>
