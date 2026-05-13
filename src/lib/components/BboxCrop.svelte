<script>
  let { imageUrl, bbox, size = 56, scanning = true } = $props();

  // bbox: list of 4 corner points [[x,y], ...] in 0..1 normalized image coords.
  // Compute centroid + a padded square window around it, then use CSS
  // background-position to "zoom into" that region without a canvas.
  const computed = $derived.by(() => {
    if (!imageUrl || !bbox || bbox.length < 4) return null;
    const xs = bbox.map((p) => p[0]);
    const ys = bbox.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // Pad the larger dimension by 60% to show context around the code.
    const raw = Math.max(x1 - x0, y1 - y0) * 1.6;
    // Clamp so the formula doesn't blow up near the edges.
    const win = Math.max(0.04, Math.min(0.85, raw));
    const sz = 100 / win;  // background-size in %
    const posX = Math.max(0, Math.min(100, (cx - win / 2) / (1 - win) * 100));
    const posY = Math.max(0, Math.min(100, (cy - win / 2) / (1 - win) * 100));
    return { sz, posX, posY };
  });
</script>

{#if computed && imageUrl}
  <div class="bbox-crop relative overflow-hidden rounded-md ring-1 ring-pitch-500/40"
       style="width:{size}px;height:{size}px;
              background-image:url({imageUrl});
              background-size:{computed.sz}% {computed.sz}%;
              background-position:{computed.posX}% {computed.posY}%;
              background-repeat:no-repeat;">
    <!-- Grid pattern overlay (subtle, always on) -->
    <div class="absolute inset-0 pointer-events-none bbox-grid"></div>
    <!-- Scan-line + flicker (only while scanning) -->
    {#if scanning}
      <div class="absolute inset-0 pointer-events-none bbox-scan"></div>
      <div class="absolute inset-0 pointer-events-none bbox-tint"></div>
    {/if}
    <!-- Corner brackets that fade out when scanning finishes -->
    <div class="absolute inset-0 pointer-events-none bbox-frame"
         class:bbox-frame-settled={!scanning}></div>
  </div>
{:else}
  <div class="rounded-md bg-white/5" style="width:{size}px;height:{size}px"></div>
{/if}

<style>
  .bbox-grid {
    background-image:
      linear-gradient(to right, rgba(34,197,94,0.15) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(34,197,94,0.15) 1px, transparent 1px);
    background-size: 8px 8px;
    mix-blend-mode: screen;
  }
  .bbox-scan {
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(34,197,94,0.0) 40%,
      rgba(34,197,94,0.55) 50%,
      rgba(34,197,94,0.0) 60%,
      transparent 100%);
    background-size: 100% 240%;
    background-position: 0% 0%;
    mix-blend-mode: screen;
    animation: bbox-scan-anim 1.4s linear infinite;
  }
  .bbox-tint {
    background: rgba(34,197,94,0.10);
    mix-blend-mode: overlay;
  }
  @keyframes bbox-scan-anim {
    0%   { background-position: 0% -100%; }
    100% { background-position: 0% 200%; }
  }
  .bbox-frame {
    --c: rgb(34 197 94);
    background:
      linear-gradient(var(--c), var(--c)) top left      / 8px 1px no-repeat,
      linear-gradient(var(--c), var(--c)) top left      / 1px 8px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 8px 1px no-repeat,
      linear-gradient(var(--c), var(--c)) top right     / 1px 8px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 8px 1px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom left   / 1px 8px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 8px 1px no-repeat,
      linear-gradient(var(--c), var(--c)) bottom right  / 1px 8px no-repeat;
    transition: opacity 0.5s ease-out;
  }
  .bbox-frame-settled { opacity: 0.35; }
</style>
