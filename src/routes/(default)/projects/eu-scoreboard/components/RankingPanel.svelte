<script>
  import RiskLegend from './RiskLegend.svelte';
  import { legendOf } from './choropleth.js';
  import { RISK_CLASSES } from './scores.js';

  // The ranking card floating over the map: legend for the choropleth, the sort
  // it is ranked by, and the leaderboard itself. Placeholder data for now —
  // there are no scoreboard endpoints, so the rows come from the page.
  export let title = 'EU Scoreboard';
  export let hazard;
  // The whole ranking, not a page of it: the card orders and pages through it
  // itself, so the controls around the list have something to act on.
  export let entries = [];
  export let pageSize = 5;

  // `entries` arrives highest risk first, so the second order is the same list
  // read from the other end. Ranks travel with the countries rather than being
  // renumbered: a country's rank is its place in the risk order, whichever end
  // you start from.
  const ORDERS = [
    { uid: 'highest', label: 'Highest risk countries' },
    { uid: 'lowest', label: 'Lowest ranked countries' },
  ];
  // The map's own classes, read low -> high so the ramp runs pale to deep, the
  // way a scale is read. Same source as the choropleth, so the two cannot drift
  // apart.
  const legend = legendOf(RISK_CLASSES);
  export let scale = legend.scale;
  export let scaleLabels = legend.labels;

  let open = true;
  let offset = 0;
  let orderIndex = 0;
  // A different ranking (another scenario, another year) starts from the top.
  $: entries, (offset = 0);
  $: order = ORDERS[orderIndex];
  $: ordered = order.uid === 'lowest' ? [...entries].reverse() : entries;
  $: lastOffset = Math.max(0, ordered.length - pageSize);
  $: visible = ordered.slice(offset, offset + pageSize);

  const step = (by) => (offset = Math.min(Math.max(offset + by * pageSize, 0), lastOffset));

  // Reading from the other end starts at that end's top, not part-way down it.
  function toggleOrder() {
    orderIndex = (orderIndex + 1) % ORDERS.length;
    offset = 0;
  }
</script>

<div class="w-[293px] max-w-full rounded bg-white shadow-lg">
  <div class="flex items-start justify-between gap-4 px-6 pt-4" class:pb-4={!open}>
    <h2 class="text-xl leading-tight text-theme-base">{title}</h2>
    <!-- The button IS the icon box: no padding and no offset between the two, so
         what is clickable is exactly what is drawn. The icon is sized up to 24px
         to keep that a usable target, with the bar itself still 16px wide. -->
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? 'Collapse the ranking' : 'Expand the ranking'}
      class="-mr-1 block h-6 w-6 shrink-0 text-theme-700 hover:text-theme-stronger"
      on:click={() => (open = !open)}
    >
      <svg viewBox="0 0 24 24" class="h-6 w-6" aria-hidden="true">
        <rect x="4" y="11" width="16" height="2" fill="currentColor" />
        {#if !open}<rect x="11" y="4" width="2" height="16" fill="currentColor" />{/if}
      </svg>
    </button>
  </div>

  {#if open}
    <div class="flex flex-col gap-5 px-6 pb-5 pt-3">
      <div class="flex flex-col gap-2">
        <p class="text-lg font-bold text-theme-stronger">{hazard}</p>
        <RiskLegend {scale} labels={scaleLabels} />
      </div>

      <button type="button" class="flex items-center gap-2 self-start text-sm font-semibold text-theme-stronger" on:click={toggleOrder}>
        {order.label}
        <svg viewBox="0 0 8 4" class="h-1 w-2 transition-transform" class:rotate-180={order.uid === 'lowest'} aria-hidden="true"><path d="M4 4 0 0h8z" fill="currentColor" /></svg>
      </button>

      <ol class="flex flex-col gap-3" aria-live="polite">
        {#each visible as { rank, label, value, href }, i}
          <li class="flex items-center gap-3 text-sm text-theme-stronger">
            <span class="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-2 border-theme-stronger bg-[#CE2621] text-xs font-semibold text-white">
              {rank ?? offset + i + 1}
            </span>
            <a class="min-w-0 flex-1 truncate underline" {href}>{label}</a>
            <span class="font-semibold tabular-nums">{value}</span>
          </li>
        {/each}
      </ol>

      {#if entries.length > pageSize}
        <div class="flex items-center justify-center gap-2.5">
          <button
            type="button"
            aria-label="Previous countries"
            disabled={offset === 0}
            class="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-theme-stronger text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
            on:click={() => step(-1)}
          >
            <svg viewBox="0 0 8 8" class="h-2 w-2 rotate-180" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M4 0v8M.5 4.5 4 8l3.5-3.5" /></svg>
          </button>
          <button
            type="button"
            aria-label="Next countries"
            disabled={offset >= lastOffset}
            class="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-theme-stronger text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
            on:click={() => step(1)}
          >
            <svg viewBox="0 0 8 8" class="h-2 w-2" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M4 0v8M.5 4.5 4 8l3.5-3.5" /></svg>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>
