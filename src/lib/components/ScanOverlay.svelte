<script>
  import { onMount, onDestroy } from 'svelte';

  // bboxes: [{id, bbox: [[x,y]...] in 0-1, status: 'verde'|'amarelo'|'tentative'|'candidate'}]
  // phasePct: 0-100 progress, drives an intensity multiplier for FX
  // imgClass: extra Tailwind classes for the underlying <img>
  let {
    imageUrl,
    scanning = true,
    bboxes = [],
    imgClass = '',
    phasePct = null,
  } = $props();

  // Two roaming reticles for richer HUD feel
  let r1 = $state({ x: 0.3, y: 0.3, opacity: 0 });
  let r2 = $state({ x: 0.7, y: 0.7, opacity: 0 });
  let timer1, timer2;

  function makeHopper(target, setter) {
    function tick() {
      setter({
        x: 0.08 + Math.random() * 0.84,
        y: 0.08 + Math.random() * 0.84,
        opacity: 0.95,
      });
      const visMs = 380 + Math.random() * 220;
      const next = () => {
        setter({ ...target, opacity: 0 });
        timer1 = setTimeout(tick, 120 + Math.random() * 160);
      };
      if (target === r1) timer1 = setTimeout(next, visMs);
      else timer2 = setTimeout(next, visMs);
    }
    return tick;
  }

  onMount(() => {
    if (!scanning) return;
    const hop1 = () => {
      r1 = { x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, opacity: 0.95 };
      timer1 = setTimeout(() => {
        r1 = { ...r1, opacity: 0 };
        timer1 = setTimeout(hop1, 140);
      }, 420 + Math.random() * 180);
    };
    const hop2 = () => {
      r2 = { x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, opacity: 0.85 };
      timer2 = setTimeout(() => {
        r2 = { ...r2, opacity: 0 };
        timer2 = setTimeout(hop2, 220);
      }, 520 + Math.random() * 220);
    };
    hop1();
    setTimeout(hop2, 280);
  });

  onDestroy(() => {
    clearTimeout(timer1);
    clearTimeout(timer2);
  });

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
    if (status === 'verde') return 'rgb(34 197 94)';
    if (status === 'amarelo') return 'rgb(251 191 36)';
    if (status === 'candidate') return 'rgb(148 163 184)';
    return 'rgb(251 191 36)';
  }
</script>

<div class="scan-overlay-root relative inline-block w-full">
  <img src={imageUrl} alt="" class="block w-full h-auto rounded-xl select-none {imgClass}" />

  {#if scanning}
    <!-- Layered HUD: -->
    <!-- 1. Subtle grid -->
    <div class="absolute inset-0 pointer-events-none scan-grid rounded-xl"></div>
    <!-- 2. Vertical scan-line sweep -->
    <div class="absolute inset-0 pointer-events-none scan-line rounded-xl"></div>
    <!-- 3. Secondary horizontal scan-line (offset phase) for crosshatch feel -->
    <div class="absolute inset-0 pointer-events-none scan-line-h rounded-xl"></div>
    <!-- 4. Corner brackets framing the full frame -->
    <div class="absolute inset-0 pointer-events-none scan-frame rounded-xl"></div>
    <!-- 5. Edge glow ring pulsing at the rim -->
    <div class="absolute inset-0 pointer-events-none scan-ring rounded-xl"></div>
    <!-- 6. Two roaming reticles -->
    <div class="absolute pointer-events-none reticle reticle-primary"
         style="left:calc({r1.x * 100}% - 14px); top:calc({r1.y * 100}% - 14px); opacity:{r1.opacity};"></div>
    <div class="absolute pointer-events-none reticle reticle-secondary"
         style="left:calc({r2.x * 100}% - 10px); top:calc({r2.y * 100}% - 10px); opacity:{r2.opacity};"></div>
    <!-- 7. Phase glow bar -->
    {#if phasePct !== null && phasePct > 0 && phasePct < 100}
      <div class="absolute left-0 right-0 bottom-0 phase-bar pointer-events-none">
        <div class="phase-bar-fill" style="width:{phasePct}%;"></div>
      </div>
    {/if}
  {/if}

  <!-- Bbox markers — real detections from the stream. -->
  {#each bboxes as b (b.id)}
    {@const r = bboxRect(b.bbox)}
    {#if b.status === 'tentative'}
      <div class="absolute pointer-events-none tentative-mark animate-[fadein_0.25s_ease-out]"
           style="left:{r.left};top:{r.top};width:{r.width};height:{r.height};">
        <div class="tentative-circle"></div>
        <div class="tentative-q">?</div>
      </div>
    {:else if b.status === 'candidate'}
      <div class="absolute pointer-events-none candidate-mark animate-[fadein_0.2s_ease-out]"
           style="left:{r.left};top:{r.top};width:{r.width};height:{r.height};"></div>
    {:else}
      <div class="absolute pointer-events-none bbox-mark animate-[bbox-arrive_0.45s_cubic-bezier(.2,.7,.2,1)]"
           style="left:{r.left};top:{r.top};width:{r.width};height:{r.height};
                  --c:{bboxColor(b.status)};">
        <div class="bbox-corner tl"></div>
        <div class="bbox-corner tr"></div>
        <div class="bbox-corner bl"></div>
        <div class="bbox-corner br"></div>
        <!-- Scan-reveal sweep that runs once when bbox arrives -->
        <div class="bbox-sweep"></div>
        <!-- Outer pulse ring fades after first second -->
        <div class="bbox-pulse"></div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .scan-overlay-root img { -webkit-user-drag: none; }
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
      rgba(34,197,94,0.75) 50%,
      rgba(34,197,94,0.0) 58%,
      transparent 100%);
    background-size: 100% 240%;
    background-position: 0% 0%;
    mix-blend-mode: screen;
    animation: line-sweep 2.0s linear infinite;
  }
  .scan-line-h {
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(56,189,248,0.0) 42%,
      rgba(56,189,248,0.45) 50%,
      rgba(56,189,248,0.0) 58%,
      transparent 100%);
    background-size: 240% 100%;
    background-position: 0% 0%;
    mix-blend-mode: screen;
    animation: line-sweep-h 3.2s linear infinite;
    opacity: 0.7;
  }
  @keyframes line-sweep {
    0%   { background-position: 0% -100%; }
    100% { background-position: 0% 200%; }
  }
  @keyframes line-sweep-h {
    0%   { background-position: -100% 0%; }
    100% { background-position: 200% 0%; }
  }
  .scan-frame {
    --c: rgb(34 197 94);
    background:
      linear-gradient(var(--c), var(--c)) top left      / 18px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top left      / 2px 18px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 18px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 2px 18px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 18px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 2px 18px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 18px 2px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 2px 18px no-repeat;
    filter: drop-shadow(0 0 4px rgba(34,197,94,0.6));
  }
  .scan-ring {
    box-shadow:
      inset 0 0 0 1px rgba(34,197,94,0.20),
      inset 0 0 22px rgba(34,197,94,0.18);
    animation: ring-pulse 3.4s ease-in-out infinite;
  }
  @keyframes ring-pulse {
    0%,100% { box-shadow: inset 0 0 0 1px rgba(34,197,94,0.20), inset 0 0 22px rgba(34,197,94,0.18); }
    50%     { box-shadow: inset 0 0 0 1px rgba(56,189,248,0.30), inset 0 0 32px rgba(56,189,248,0.22); }
  }
  .reticle {
    border-radius: 9999px;
    transition: left 0.5s cubic-bezier(.4,.2,.2,1),
                top  0.5s cubic-bezier(.4,.2,.2,1),
                opacity 0.25s linear;
  }
  .reticle-primary {
    width: 28px; height: 28px;
    border: 1px solid rgba(34,197,94,0.85);
    box-shadow: 0 0 14px rgba(34,197,94,0.55), inset 0 0 6px rgba(34,197,94,0.4);
  }
  .reticle-secondary {
    width: 20px; height: 20px;
    border: 1px dashed rgba(56,189,248,0.85);
    box-shadow: 0 0 10px rgba(56,189,248,0.45);
  }
  .reticle::before, .reticle::after {
    content: ''; position: absolute; background: currentColor; color: rgba(34,197,94,0.85);
  }
  .reticle-secondary::before, .reticle-secondary::after { color: rgba(56,189,248,0.85); }
  .reticle::before { left: 50%; top: -6px; bottom: -6px; width: 1px; transform: translateX(-50%); }
  .reticle::after  { top: 50%; left: -6px; right: -6px; height: 1px; transform: translateY(-50%); }

  /* Phase bar — neon stripe at the bottom edge while scanning. */
  .phase-bar {
    height: 3px;
    background: rgba(255,255,255,0.06);
    overflow: hidden;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
  }
  .phase-bar-fill {
    height: 100%;
    background: linear-gradient(90deg,
      rgba(34,197,94,0.7) 0%,
      rgba(56,189,248,0.9) 50%,
      rgba(251,191,36,0.95) 100%);
    box-shadow: 0 0 10px rgba(56,189,248,0.6);
    transition: width 0.3s ease-out;
  }

  /* Bbox arrival: lift+scale, then settle */
  @keyframes bbox-arrive {
    0%   { transform: scale(1.5); opacity: 0; filter: blur(6px); }
    60%  { transform: scale(0.96); opacity: 1; filter: blur(0); }
    100% { transform: scale(1);    opacity: 1; }
  }

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

  /* One-shot scan-reveal: sweep light bar fills the bbox area then fades. */
  .bbox-sweep {
    position: absolute; inset: 0;
    background: linear-gradient(90deg,
      transparent,
      color-mix(in srgb, var(--c) 65%, transparent),
      transparent);
    opacity: 0;
    transform: translateX(-100%);
    animation: bbox-sweep 0.7s ease-out 0.1s 1;
  }
  @keyframes bbox-sweep {
    0%   { opacity: 0;   transform: translateX(-100%); }
    35%  { opacity: 0.9; }
    100% { opacity: 0;   transform: translateX(120%); }
  }
  /* Pulse ring that breathes for ~2s then settles. */
  .bbox-pulse {
    position: absolute; inset: -6px;
    border: 1px solid var(--c);
    border-radius: 6px;
    opacity: 0;
    animation: bbox-pulse 1.6s ease-out 1;
  }
  @keyframes bbox-pulse {
    0%   { opacity: 0.9; transform: scale(0.92); }
    100% { opacity: 0;   transform: scale(1.12); }
  }

  /* Tentative: pulsing amber circle stamped over the unread region. */
  .tentative-mark { display: grid; place-items: center; }
  .tentative-circle {
    position: absolute; inset: -4px;
    border: 2px dashed rgb(251 191 36);
    border-radius: 9999px;
    box-shadow: 0 0 12px rgba(251,191,36,0.65), inset 0 0 10px rgba(251,191,36,0.3);
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

  /* Candidate: thin dashed outline pre-OCR. */
  .candidate-mark {
    border: 2px dashed rgba(148, 163, 184, 0.85);
    box-shadow: 0 0 6px rgba(148, 163, 184, 0.45);
    border-radius: 6px;
    animation: candidate-pulse 1.6s ease-in-out infinite;
  }
  @keyframes candidate-pulse {
    0%,100% { opacity: 0.85; }
    50%     { opacity: 0.45; }
  }
</style>
