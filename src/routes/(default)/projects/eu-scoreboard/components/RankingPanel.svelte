<script>
  import Chevron from '$lib/components/icons/Chevron.svelte';
  import RiskLegend from './RiskLegend.svelte';
  import { legendOf } from './choropleth.js';
  import { RISK_CLASSES } from './scores.js';

  // The ranking card floating over the map: legend for the choropleth, the sort
  // it is ranked by, and the leaderboard itself. Placeholder data for now —
  // there are no scoreboard endpoints, so the rows come from the page.
  export let title = 'EU Scoreboard';
  export let hazard;
  export let sort = 'Highest risk countries';
  export let entries = [];
  // The map's own classes, read High -> very low so the ramp runs the same way
  // as the leaderboard under it. Same source as the choropleth, so the two
  // cannot drift apart.
  const legend = legendOf(RISK_CLASSES, { highestFirst: true });
  export let scale = legend.scale;
  export let scaleLabels = legend.labels;

  let open = true;
</script>

<div class="w-[19rem] max-w-full rounded bg-white shadow-lg">
  <div class="flex items-start justify-between gap-4 px-5 pt-4" class:pb-4={!open}>
    <h2 class="text-lg leading-tight text-theme-base">{title}</h2>
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? 'Collapse the ranking' : 'Expand the ranking'}
      class="-mr-1 -mt-1 p-1 leading-none text-text-weaker hover:text-theme-base"
      on:click={() => (open = !open)}
    >
      {open ? '–' : '+'}
    </button>
  </div>

  {#if open}
    <div class="flex flex-col gap-4 px-5 pb-4 pt-3">
      <div class="flex flex-col gap-1.5">
        <p class="text-sm font-semibold">{hazard}</p>
        <RiskLegend {scale} labels={scaleLabels} />
      </div>

      <button type="button" class="flex items-center gap-1 self-start text-sm font-semibold text-theme-base">
        {sort}
        <Chevron class="h-4 w-4" />
      </button>

      <ol class="flex flex-col gap-2.5">
        {#each entries as { rank, label, value, href }, i}
          <li class="flex items-center gap-3 text-sm">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C91C1C] text-xs font-semibold text-white">
              {rank ?? i + 1}
            </span>
            <a class="min-w-0 flex-1 truncate underline text-theme-base" {href}>{label}</a>
            <span class="font-semibold tabular-nums">{value}</span>
          </li>
        {/each}
      </ol>

      <div class="flex justify-center gap-3 pt-1">
        <button type="button" aria-label="Previous countries" class="flex h-7 w-7 items-center justify-center rounded-full bg-theme-50 text-theme-base hover:bg-theme-100">
          <Chevron class="h-4 w-4 rotate-180" />
        </button>
        <button type="button" aria-label="Next countries" class="flex h-7 w-7 items-center justify-center rounded-full bg-theme-50 text-theme-base hover:bg-theme-100">
          <Chevron class="h-4 w-4" />
        </button>
      </div>
    </div>
  {/if}
</div>
