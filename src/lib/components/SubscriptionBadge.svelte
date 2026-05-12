<script>
  import { daysRemaining, isAuthenticated } from '../stores/authState.svelte.js';

  let days = $derived(daysRemaining());
  let color = $derived(days <= 3 ? 'text-flag' : days <= 7 ? 'text-gold' : 'text-ink-300');
</script>

{#if isAuthenticated()}
  <div class="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] {color}">
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-60"></span>
    {days} {days === 1 ? 'dia' : 'dias'}
  </div>
{/if}
