<script>
  import {
    duplicates, totalDuplicates,
    commitmentsByType, pendingGiveForCode, lookupSticker,
    uniqueOwned, completionPct, uniqueSpecialOwned
  } from '../stores/derived.svelte.js';
  import { totalStickers, totalSpecial } from '../data/album.js';
  import { teams } from '../data/teams.js';
  import {
    addSticker, addCommitment, removeCommitment, fulfillGive, fulfillExpect, knownPeople
  } from '../stores/appState.svelte.js';
  import { formatStickerLabel } from '../utils/format.js';
  import Header from '../components/Header.svelte';

  const teamByCode = Object.fromEntries(teams.map((t) => [t.code, t]));

  let query = $state('');
  let selected = $state(new Set());          // Set<code>
  let sheet = $state(null);                  // null | 'give' | 'expect' | 'expect-bulk' | 'commitments'
  let personInput = $state('');
  let bulkInput = $state('');

  const matchesQuery = (sticker) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [sticker.code, sticker.section, sticker.team || '']
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(q));
  };

  // Extrai o numero da figurinha (BRA17 -> 17, FWC4 -> 4, MC-BRA -> null, CAPA -> null).
  function stickerNumber(sticker) {
    const m = sticker.code.match(/^[A-Z]+(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Agrupa repetidas por "linha" (time / abertura / MC).
  // Cada grupo: { key, label, flag, kind: 'team'|'special'|'mc', stickers: [{ sticker, extras, count, number }] }
  const groups = $derived(() => {
    const map = new Map();
    for (const { sticker, count, extras } of duplicates()) {
      if (!matchesQuery(sticker)) continue;
      let key, label, flag, kind;
      if (sticker.mc) {
        key = 'mc';
        label = 'Seleções MC';
        flag = '🍔';
        kind = 'mc';
      } else if (sticker.team) {
        key = `team:${sticker.team}`;
        const t = teamByCode[sticker.team];
        label = t?.name || sticker.section;
        flag = t?.flag || '';
        kind = 'team';
      } else {
        key = 'special';
        label = 'Abertura · Especiais';
        flag = '✨';
        kind = 'special';
      }
      if (!map.has(key)) map.set(key, { key, label, flag, kind, stickers: [], teamCode: sticker.team || null });
      map.get(key).stickers.push({ sticker, extras, count, number: stickerNumber(sticker) });
    }
    // ordena dentro de cada grupo por numero (ou codigo se nao tiver numero)
    for (const g of map.values()) {
      g.stickers.sort((a, b) => {
        if (a.number != null && b.number != null) return a.number - b.number;
        return a.sticker.code.localeCompare(b.sticker.code);
      });
    }
    // ordem dos grupos: especiais primeiro, depois times alfabetico, MC por ultimo
    const arr = [...map.values()];
    arr.sort((a, b) => {
      const order = { special: 0, team: 1, mc: 2 };
      if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
      return a.label.localeCompare(b.label, 'pt-BR');
    });
    return arr;
  });

  const selectedCount = $derived(() => selected.size);
  const peopleSuggestions = $derived(() => knownPeople());
  const expecting = $derived(() => commitmentsByType('expect'));
  const giving = $derived(() => commitmentsByType('give'));

  function toggleSelect(code) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    selected = next;
  }

  function selectAllInGroup(g) {
    const next = new Set(selected);
    const allSel = g.stickers.every((s) => next.has(s.sticker.code));
    if (allSel) for (const s of g.stickers) next.delete(s.sticker.code);
    else for (const s of g.stickers) next.add(s.sticker.code);
    selected = next;
  }

  function clearSelection() { selected = new Set(); }

  function openSheet(name) {
    personInput = '';
    bulkInput = '';
    sheet = name;
  }
  function closeSheet() { sheet = null; }

  function confirmGive() {
    const codes = [...selected];
    if (codes.length === 0) return;
    for (const code of codes) addCommitment({ type: 'give', code, person: personInput });
    clearSelection();
    closeSheet();
  }

  function confirmExpect() {
    const codes = [...selected];
    if (codes.length === 0) return;
    for (const code of codes) addCommitment({ type: 'expect', code, person: personInput });
    clearSelection();
    closeSheet();
  }

  function confirmExpectBulk() {
    const raw = bulkInput.trim();
    if (!raw) return;
    const tokens = raw.split(/[,\s\n]+/).map((t) => t.trim()).filter(Boolean);
    let added = 0;
    for (const t of tokens) {
      const norm = t.toUpperCase().replace(/\s+/g, '');
      const candidates = [norm];
      if (norm.startsWith('MC') && !norm.includes('-')) candidates.push('MC-' + norm.slice(2));
      const found = candidates.map((c) => lookupSticker(c)).find(Boolean);
      if (!found) continue;
      addCommitment({ type: 'expect', code: found.code, person: personInput });
      added++;
    }
    if (added > 0) closeSheet();
  }

  // --- Share: formato pedido pelo Josh, espelhando o exemplo da galera ---
  function shareList() {
    const lines = [];
    lines.push('🏆 Figs · Copa 2026');
    lines.push('🇺🇸 🇨🇦 🇲🇽');
    lines.push('');
    lines.push('Repetidas:');

    // Agrupa por time pra montar "BRA 🇧🇷: 1, 5, 17"
    const byTeam = new Map();
    const fwc = [];      // FWC1..19
    const mc = [];       // MC-XXX
    let capa = false;
    for (const { sticker, extras } of duplicates()) {
      if (sticker.code === 'CAPA') { capa = true; continue; }
      if (sticker.mc) { mc.push(sticker.team); continue; }
      if (sticker.code.startsWith('FWC')) {
        const n = parseInt(sticker.code.replace('FWC', ''), 10);
        if (!isNaN(n)) fwc.push(n);
        continue;
      }
      if (!sticker.team) continue;
      if (!byTeam.has(sticker.team)) byTeam.set(sticker.team, []);
      const num = stickerNumber(sticker);
      if (num != null) {
        // Se tiver mais de 1 extra, indica com (×N)
        byTeam.get(sticker.team).push(extras > 1 ? `${num} (×${extras})` : `${num}`);
      }
    }
    // ordem alfabetica por codigo do time
    const ordered = [...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [code, nums] of ordered) {
      const t = teamByCode[code];
      const flag = t?.flag || '';
      const sortedNums = nums.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
      lines.push(`${code} ${flag}: ${sortedNums.join(', ')}`);
    }
    if (fwc.length > 0) {
      fwc.sort((a, b) => a - b);
      lines.push(`FWC ✨: ${fwc.join(', ')}`);
    }
    if (capa) lines.push('CAPA ⭐');
    if (mc.length > 0) {
      lines.push('');
      lines.push(`🍔 Seleções MC: ${mc.sort().join(', ')}`);
    }
    if (duplicates().length === 0) {
      lines.push('(sem repetidas no momento)');
    }

    lines.push('');
    lines.push(`Tenho ${uniqueOwned()}/${totalStickers} (${completionPct().toFixed(1)}%) · ${uniqueSpecialOwned()}/${totalSpecial} douradas ★`);
    lines.push('https://joshazze.github.io/figurinhas-copa/');

    const text = lines.join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
      navigator.share({ title: 'Minhas repetidas', text }).catch(() => window.open(url, '_blank'));
    } else {
      window.open(url, '_blank');
    }
  }
</script>

<section class="screen-enter pb-40">
  <Header sub="Pra trocar com a galera" title="Repetidas" />

  <!-- Action chips: leves, sem destaque excessivo -->
  <div class="px-5 flex items-center gap-2 mb-3 min-w-0">
    <button class="btn btn-ghost !py-2 !px-3 text-xs flex-1 min-w-0 whitespace-nowrap"
            onclick={() => openSheet('commitments')} type="button">
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M5 7l5 5-5 5M14 7l5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="truncate">compromissos</span>
      {#if expecting().length + giving().length > 0}
        <span class="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gold-400/25 text-gold-400 text-[10px] px-1">
          {expecting().length + giving().length}
        </span>
      {/if}
    </button>
    <button class="btn btn-ghost !py-2 !px-3 text-xs flex-1 min-w-0 whitespace-nowrap"
            onclick={shareList} type="button">
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="truncate">compartilhar</span>
    </button>
  </div>

  <!-- Stats inline -->
  <div class="px-5 mb-4">
    <div class="flex items-baseline justify-between gap-4">
      <div class="flex items-baseline gap-1.5">
        <span class="num text-3xl text-gold-400 leading-none">{totalDuplicates()}</span>
        <span class="text-[11px] uppercase tracking-[0.18em] text-ink-300">repetidas</span>
      </div>
      <div class="text-right text-[11px] text-ink-300">
        <div><span class="text-white font-semibold">{duplicates().length}</span> títulos</div>
        {#if giving().length > 0}<div class="text-flag-400"><span class="font-semibold">{giving().length}</span> prometidas</div>{/if}
        {#if expecting().length > 0}<div class="text-pitch-400"><span class="font-semibold">{expecting().length}</span> esperando</div>{/if}
      </div>
    </div>
  </div>

  <!-- Filtro -->
  <div class="px-5 mb-3">
    <input bind:value={query} class="input !py-2.5 text-sm" placeholder="Filtrar por código, time ou seleção" type="search" />
  </div>

  <!-- Lista por time/grupo -->
  <div class="px-5 space-y-3">
    {#each groups() as g (g.key)}
      {@const allSelected = g.stickers.every((s) => selected.has(s.sticker.code))}
      <section class="rounded-2xl bg-white/[0.035] border border-white/[0.08] overflow-hidden">
        <header class="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
          <span class="text-xl leading-none shrink-0">{g.flag}</span>
          <div class="flex-1 min-w-0">
            {#if g.kind === 'team'}
              <div class="flex items-baseline gap-1.5 min-w-0">
                <span class="display text-lg font-bold text-white tracking-tight leading-none">{g.teamCode}</span>
                <span class="text-[11px] text-ink-300 truncate">{g.label}</span>
              </div>
            {:else}
              <div class="display text-base font-bold text-white tracking-tight leading-none truncate">{g.label}</div>
            {/if}
            <div class="text-[10px] uppercase tracking-wide text-ink-400 mt-0.5">
              {g.stickers.length} título{g.stickers.length === 1 ? '' : 's'} ·
              {g.stickers.reduce((acc, s) => acc + s.extras, 0)} pra trocar
            </div>
          </div>
          <button type="button"
                  class="text-[10px] uppercase tracking-wider {allSelected ? 'text-flag-400' : 'text-ink-300'}"
                  onclick={() => selectAllInGroup(g)}>
            {allSelected ? 'tirar' : 'tudo'}
          </button>
        </header>

        <!-- Chips de figurinhas: nomes em destaque, +N pequeno, promet. com tint vermelho -->
        <div class="p-3 flex flex-wrap gap-2">
          {#each g.stickers as { sticker, extras, count, number } (sticker.code)}
            {@const isSel = selected.has(sticker.code)}
            {@const committed = pendingGiveForCode(sticker.code)}
            <button type="button"
                    onclick={() => toggleSelect(sticker.code)}
                    class="relative px-2.5 py-1.5 rounded-xl border transition shrink-0
                           {isSel
                             ? 'bg-flag-400/20 border-flag-400 text-white ring-2 ring-flag-400/40'
                             : committed > 0
                               ? 'bg-flag-400/5 border-flag-400/30 text-flag-300 hover:bg-flag-400/10'
                               : 'bg-gold-400/8 border-gold-400/25 text-gold-200 hover:bg-gold-400/15'}">
              <span class="num text-base leading-none">
                {#if g.kind === 'team' && number != null}{number}{:else}{formatStickerLabel(sticker)}{/if}
              </span>
              {#if extras > 1}
                <span class="ml-1 text-[10px] opacity-75">×{extras}</span>
              {/if}
              {#if committed > 0}
                <span class="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-flag-500 text-[9px] text-white grid place-items-center font-bold border border-ink-950">
                  {committed}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </section>
    {/each}

    {#if groups().length === 0}
      <div class="card p-10 text-center text-ink-300">
        <div class="display text-lg text-white">Sem repetidas por aqui.</div>
        <div class="mt-1 text-sm">{query ? 'Nenhum resultado pro filtro.' : 'Quando bater alguma, ela aparece nesta lista.'}</div>
        {#if !query}
          <div class="mt-4">
            <button class="btn btn-ghost text-xs" onclick={() => openSheet('expect-bulk')}>
              adicionar lote (esperando receber)
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>

<!-- ===== Floating action menu ===== -->
{#if selectedCount() > 0 && !sheet}
  <div class="fixed inset-x-0 bottom-[78px] z-50 px-3">
    <div class="card mx-auto max-w-md w-full p-3 tricolor-bar min-w-0">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs uppercase tracking-[0.18em] text-ink-300">
          {selectedCount()} selecionada{selectedCount() === 1 ? '' : 's'}
        </div>
        <button class="text-[11px] text-ink-300 underline" onclick={clearSelection}>limpar</button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-primary !py-2.5 text-sm" onclick={() => openSheet('give')} type="button">
          prometer entregar
        </button>
        <button class="btn btn-gold !py-2.5 text-sm" onclick={() => openSheet('expect')} type="button">
          marcar como esperada
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ===== Bottom sheets ===== -->
{#if sheet}
  <div class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onclick={closeSheet} role="presentation"></div>
  <div class="fixed inset-x-0 bottom-0 z-[61] px-3 pb-[max(0.6rem,var(--safe-bottom))]">
    <div class="card mx-auto max-w-md w-full p-5 tricolor-bar min-w-0"
         onclick={(e) => e.stopPropagation()} role="presentation">
      {#if sheet === 'give'}
        <h3 class="display text-xl font-bold text-white">Prometer entregar</h3>
        <p class="text-xs text-ink-300 mt-1">
          {selectedCount()} figurinha{selectedCount() === 1 ? '' : 's'} ficará{selectedCount() === 1 ? '' : 'o'} marcada{selectedCount() === 1 ? '' : 's'} como compromisso. Ao marcar "entregue" depois, a repetida sai do seu monte.
        </p>
        <input class="input mt-4" placeholder="Pra quem? (apelido)" bind:value={personInput} list="people-list" type="text" />
        <datalist id="people-list">{#each peopleSuggestions() as p}<option value={p}></option>{/each}</datalist>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn btn-ghost" onclick={closeSheet} type="button">cancelar</button>
          <button class="btn btn-primary" onclick={confirmGive} type="button">confirmar</button>
        </div>

      {:else if sheet === 'expect'}
        <h3 class="display text-xl font-bold text-white">Marcar como esperada</h3>
        <p class="text-xs text-ink-300 mt-1">
          Alguém prometeu te entregar essas. Quando chegar, marca "recebida" no painel de compromissos.
        </p>
        <input class="input mt-4" placeholder="De quem? (apelido)" bind:value={personInput} list="people-list-2" type="text" />
        <datalist id="people-list-2">{#each peopleSuggestions() as p}<option value={p}></option>{/each}</datalist>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn btn-ghost" onclick={closeSheet} type="button">cancelar</button>
          <button class="btn btn-gold" onclick={confirmExpect} type="button">confirmar</button>
        </div>

      {:else if sheet === 'expect-bulk'}
        <h3 class="display text-xl font-bold text-white">Lote esperando receber</h3>
        <p class="text-xs text-ink-300 mt-1">
          Cole a lista de códigos que prometeram te entregar (ex: <span class="mono">BRA 17, FWC 4, MC BRA</span>).
        </p>
        <input class="input mt-4" placeholder="De quem? (apelido)" bind:value={personInput} list="people-list-3" type="text" />
        <datalist id="people-list-3">{#each peopleSuggestions() as p}<option value={p}></option>{/each}</datalist>
        <textarea class="input mt-3 min-h-[120px]"
                  placeholder="BRA 17, ARG 9, FWC 4, MC BRA, ..."
                  bind:value={bulkInput}></textarea>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn btn-ghost" onclick={closeSheet} type="button">cancelar</button>
          <button class="btn btn-gold" onclick={confirmExpectBulk} type="button">adicionar</button>
        </div>

      {:else if sheet === 'commitments'}
        <div class="flex items-center justify-between">
          <h3 class="display text-xl font-bold text-white">Compromissos</h3>
          <button class="text-xs text-ink-300 underline" onclick={closeSheet}>fechar</button>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-ghost !py-2 text-xs" onclick={() => openSheet('expect-bulk')} type="button">
            + lote esperando
          </button>
        </div>

        {#if expecting().length > 0}
          <div class="mt-4">
            <div class="text-[10px] uppercase tracking-[0.18em] text-pitch-400 mb-1">esperando receber</div>
            <div class="rounded-xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/5">
              {#each expecting() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 p-2.5">
                  <div class="mono text-[11px] text-pitch-400 min-w-[64px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs text-ink-200 truncate">de {c.person}</div>
                  </div>
                  <button class="btn btn-ghost !py-1 !px-2 text-[10px]" onclick={() => fulfillExpect(c.id)} type="button">recebida</button>
                  <button class="text-ink-400 px-2 text-xs" onclick={() => removeCommitment(c.id)} type="button" aria-label="remover">✕</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if giving().length > 0}
          <div class="mt-4">
            <div class="text-[10px] uppercase tracking-[0.18em] text-flag-400 mb-1">prometidas pra entregar</div>
            <div class="rounded-xl bg-white/[0.04] border border-white/[0.08] divide-y divide-white/5">
              {#each giving() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 p-2.5">
                  <div class="mono text-[11px] text-flag-400 min-w-[64px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs text-ink-200 truncate">pra {c.person}</div>
                  </div>
                  <button class="btn btn-ghost !py-1 !px-2 text-[10px]" onclick={() => fulfillGive(c.id)} type="button">entregue</button>
                  <button class="text-ink-400 px-2 text-xs" onclick={() => removeCommitment(c.id)} type="button" aria-label="remover">✕</button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if expecting().length === 0 && giving().length === 0}
          <div class="mt-4 text-center text-sm text-ink-300 py-4">
            Nenhum compromisso ainda. Selecione repetidas pra prometer, ou adicione um lote de esperadas.
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}
