<script>
  import {
    duplicates, totalDuplicates,
    commitmentsByType, commitmentsByCode, pendingGiveForCode, lookupSticker
  } from '../stores/derived.svelte.js';
  import { totalStickers, totalSpecial } from '../data/album.js';
  import { uniqueOwned, completionPct, uniqueSpecialOwned } from '../stores/derived.svelte.js';
  import {
    addSticker, addCommitment, removeCommitment, fulfillGive, fulfillExpect, knownPeople
  } from '../stores/appState.svelte.js';
  import { formatStickerLabel, stickerSubtitle } from '../utils/format.js';
  import Header from '../components/Header.svelte';

  let query = $state('');
  let selected = $state(new Set());          // Set<code>
  let sheet = $state(null);                  // null | 'give' | 'expect' | 'expect-bulk' | 'share' | 'commitments'
  let personInput = $state('');
  let bulkInput = $state('');

  const items = $derived(() => {
    const q = query.trim().toLowerCase();
    const list = duplicates();
    if (!q) return list;
    return list.filter(({ sticker }) => {
      const label = formatStickerLabel(sticker).toLowerCase();
      const sub = stickerSubtitle(sticker).toLowerCase();
      return `${sticker.code} ${label} ${sub} ${sticker.section}`.toLowerCase().includes(q);
    });
  });

  const groupedBySection = $derived(() => {
    const map = new Map();
    for (const it of items()) {
      const key = it.sticker.section;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()].map(([section, list]) => ({ section, list }));
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

  function clearSelection() {
    selected = new Set();
  }

  function openSheet(name) {
    personInput = '';
    bulkInput = '';
    sheet = name;
  }

  function closeSheet() {
    sheet = null;
  }

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

  // Bulk-add (ex: "as 13 do MC") — usuario cola lista separada por virgula/espaco/novalinha
  function confirmExpectBulk() {
    const raw = bulkInput.trim();
    if (!raw) return;
    const tokens = raw.split(/[,\s\n]+/).map((t) => t.trim()).filter(Boolean);
    let added = 0;
    for (const t of tokens) {
      // aceita "BRA 17", "BRA17", "MC BRA" — normaliza
      const norm = t.toUpperCase().replace(/\s+/g, '');
      // tenta como esta + tenta com hifen MC (MCBRA -> MC-BRA)
      const candidates = [norm];
      if (norm.startsWith('MC') && !norm.includes('-')) candidates.push('MC-' + norm.slice(2));
      const found = candidates.map((c) => lookupSticker(c)).find(Boolean);
      if (!found) continue;
      addCommitment({ type: 'expect', code: found.code, person: personInput });
      added++;
    }
    if (added > 0) closeSheet();
  }

  function shareList() {
    const dups = duplicates();
    const lines = [];
    lines.push('📕 *Álbum Copa 2026*');
    lines.push('');
    lines.push('📊 *Meu progresso*');
    lines.push(`• ${uniqueOwned()}/${totalStickers} figurinhas (${completionPct().toFixed(1)}%)`);
    lines.push(`• ${uniqueSpecialOwned()}/${totalSpecial} douradas ★`);
    lines.push(`• ${totalDuplicates()} repetidas pra trocar`);
    lines.push('');
    if (dups.length === 0) {
      lines.push('Sem repetidas no momento.');
    } else {
      lines.push('🔄 *Repetidas* (código ×qtd):');
      // agrupado por secao
      const map = new Map();
      for (const { sticker, extras } of dups) {
        if (!map.has(sticker.section)) map.set(sticker.section, []);
        map.get(sticker.section).push(`${formatStickerLabel(sticker)} ×${extras}`);
      }
      for (const [section, list] of map) {
        lines.push(`• _${section}_: ${list.join(', ')}`);
      }
    }
    const text = lines.join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
      navigator.share({ title: 'Minhas repetidas', text }).catch(() => {
        window.open(url, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
  }
</script>

<section class="screen-enter pb-40">
  <Header sub="Pra trocar com a galera" title="Repetidas" />

  <div class="px-5 flex items-center gap-2 mb-3 min-w-0">
    <button class="btn btn-ghost !py-2 !px-3 text-xs flex-1 min-w-0 whitespace-nowrap"
            onclick={() => openSheet('commitments')} type="button">
      <span class="truncate">compromissos</span>
      {#if expecting().length + giving().length > 0}
        <span class="ml-1 shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gold-400/25 text-gold-400 text-[10px] px-1">
          {expecting().length + giving().length}
        </span>
      {/if}
    </button>
    <button class="btn btn-primary !py-2 !px-3 text-xs flex-1 min-w-0 whitespace-nowrap"
            onclick={shareList} type="button">
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="truncate">mandar no zap</span>
    </button>
  </div>

  <div class="px-5">
    <div class="card p-4 grid grid-cols-3 gap-2 text-center">
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">repetidas</div>
        <div class="num text-2xl text-gold-400 mt-1">{totalDuplicates()}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">títulos</div>
        <div class="num text-2xl text-white mt-1">{duplicates().length}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-[0.14em] text-ink-300">promet.</div>
        <div class="num text-2xl text-flag-400 mt-1">{giving().length}</div>
      </div>
    </div>

    {#if expecting().length > 0}
      <div class="mt-3 card p-3 flex items-center gap-3 border-pitch-400/30">
        <div class="h-8 w-8 grid place-items-center rounded-lg bg-pitch-400/15 text-pitch-400 text-xs font-bold">
          {expecting().length}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-white">esperando receber</div>
          <div class="text-[11px] text-ink-300">prometidas pra você por outros</div>
        </div>
        <button class="text-[11px] text-pitch-400 underline" onclick={() => openSheet('commitments')}>ver</button>
      </div>
    {/if}

    <div class="mt-4">
      <input
        bind:value={query}
        class="input"
        placeholder="Filtrar (ex: BRA 17, FWC, brasil)"
        type="search"
      />
    </div>
  </div>

  <div class="mt-4 px-5 space-y-5">
    {#each groupedBySection() as g (g.section)}
      <section>
        <h2 class="display text-base font-semibold text-white mb-2">{g.section}</h2>
        <div class="card divide-y divide-white/5">
          {#each g.list as { sticker, count, extras } (sticker.code)}
            {@const committed = pendingGiveForCode(sticker.code)}
            {@const isSelected = selected.has(sticker.code)}
            <div class="flex items-stretch gap-2 transition
                        {isSelected ? 'bg-flag-400/10' : ''}">
              <button type="button"
                      class="flex-1 min-w-0 flex items-center gap-3 p-3 text-left hover:bg-white/[0.03]"
                      onclick={() => toggleSelect(sticker.code)}
                      aria-pressed={isSelected}>
                <div class="h-12 w-12 grid place-items-center rounded-xl bg-gold-400/12 border border-gold-400/35
                            mono text-gold-400 leading-none px-1 shrink-0
                            {isSelected ? 'ring-2 ring-flag-400' : ''}">
                  <span class="text-[11px] font-bold">{formatStickerLabel(sticker)}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="display text-lg font-bold text-white tracking-tight truncate">
                    {formatStickerLabel(sticker)}
                  </div>
                  <div class="text-[11px] text-ink-300 truncate">
                    {stickerSubtitle(sticker)}
                  </div>
                  <div class="mt-1 flex items-center gap-2 flex-wrap">
                    <span class="chip !py-0 !px-2 !text-[10px] chip-sun">×{count}</span>
                    <span class="text-[10px] uppercase tracking-wide text-ink-400">{extras} pra trocar</span>
                    {#if committed > 0}
                      <span class="chip !py-0 !px-2 !text-[10px] chip-coral">{committed} promet.</span>
                    {/if}
                  </div>
                </div>
              </button>
              <div class="flex items-center gap-1 pr-3">
                <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        onclick={() => addSticker(sticker.code, -1)} type="button" aria-label="diminuir">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" stroke-linecap="round"/></svg>
                </button>
                <button class="h-8 w-8 grid place-items-center rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        onclick={() => addSticker(sticker.code, 1)} type="button" aria-label="aumentar">
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if groupedBySection().length === 0}
      <div class="card p-10 text-center text-ink-300">
        <div class="display text-lg text-white">Sem repetidas por aqui.</div>
        <div class="mt-1 text-sm">Quando bater alguma, ela aparece nesta lista.</div>
        <div class="mt-4">
          <button class="btn btn-ghost text-xs" onclick={() => openSheet('expect-bulk')}>
            adicionar lote (esperando)
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>

<!-- ===== Floating action menu (aparece quando ha selecao) ===== -->
{#if selectedCount() > 0 && !sheet}
  <div class="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.6rem,var(--safe-bottom))] pt-2
              bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent">
    <div class="card mx-auto max-w-md p-3 tricolor-bar">
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
    <div class="card mx-auto max-w-md p-5 tricolor-bar"
         onclick={(e) => e.stopPropagation()} role="presentation">
      {#if sheet === 'give'}
        <h3 class="display text-xl font-bold text-white">Prometer entregar</h3>
        <p class="text-xs text-ink-300 mt-1">
          {selectedCount()} figurinha{selectedCount() === 1 ? '' : 's'} ficará{selectedCount() === 1 ? '' : 'o'} marcada{selectedCount() === 1 ? '' : 's'} como compromisso. Ao marcar "entregue" depois, a repetida sai do seu monte.
        </p>
        <input class="input mt-4" placeholder="Pra quem? (apelido)" bind:value={personInput}
               list="people-list" type="text" />
        <datalist id="people-list">
          {#each peopleSuggestions() as p}<option value={p}></option>{/each}
        </datalist>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn btn-ghost" onclick={closeSheet} type="button">cancelar</button>
          <button class="btn btn-primary" onclick={confirmGive} type="button">confirmar</button>
        </div>

      {:else if sheet === 'expect'}
        <h3 class="display text-xl font-bold text-white">Marcar como esperada</h3>
        <p class="text-xs text-ink-300 mt-1">
          Alguém prometeu te entregar essas. Quando chegar, marca "recebida" no painel de compromissos.
        </p>
        <input class="input mt-4" placeholder="De quem? (apelido)" bind:value={personInput}
               list="people-list-2" type="text" />
        <datalist id="people-list-2">
          {#each peopleSuggestions() as p}<option value={p}></option>{/each}
        </datalist>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn btn-ghost" onclick={closeSheet} type="button">cancelar</button>
          <button class="btn btn-gold" onclick={confirmExpect} type="button">confirmar</button>
        </div>

      {:else if sheet === 'expect-bulk'}
        <h3 class="display text-xl font-bold text-white">Lote esperando receber</h3>
        <p class="text-xs text-ink-300 mt-1">
          Cole a lista de códigos que prometeram te entregar (ex: <span class="mono">BRA 17, FWC 4, MC BRA</span>).
        </p>
        <input class="input mt-4" placeholder="De quem? (apelido)" bind:value={personInput}
               list="people-list-3" type="text" />
        <datalist id="people-list-3">
          {#each peopleSuggestions() as p}<option value={p}></option>{/each}
        </datalist>
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

        <!-- esperando receber -->
        {#if expecting().length > 0}
          <div class="mt-4">
            <div class="text-[10px] uppercase tracking-[0.18em] text-pitch-400 mb-1">esperando receber</div>
            <div class="card divide-y divide-white/5">
              {#each expecting() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 p-2.5">
                  <div class="mono text-[11px] text-pitch-400 min-w-[58px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
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

        <!-- prometidas pra entregar -->
        {#if giving().length > 0}
          <div class="mt-4">
            <div class="text-[10px] uppercase tracking-[0.18em] text-flag-400 mb-1">prometidas pra entregar</div>
            <div class="card divide-y divide-white/5">
              {#each giving() as c (c.id)}
                {@const sticker = lookupSticker(c.code)}
                <div class="flex items-center gap-2 p-2.5">
                  <div class="mono text-[11px] text-flag-400 min-w-[58px]">{sticker ? formatStickerLabel(sticker) : c.code}</div>
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
