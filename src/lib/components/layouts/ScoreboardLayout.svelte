<script>
  import HeroGrain from '$lib/components/ui/HeroGrain.svelte';
  import { CLASS_SCOREBOARD_BG } from '$config';

  // Page shell for the EU scoreboard: hero -> sticky control bar -> full-bleed
  // visual (map + timeline) -> stacked split-column sections -> footer band.
  // Unlike PageLayout there is no sidebar; the section titles live in the left
  // column of each section (see ScoreboardSection).
  export let title;
  export let description = undefined;
  export let label = undefined;
  // SPARCCLE purple, shared with the header theme (see Header.svelte). Not a
  // design token yet — swap CLASS_SCOREBOARD_BG for a `bg-theme-*` token once
  // the scoreboard palette lands in color-tokens-light.json.
  export let heroClass = CLASS_SCOREBOARD_BG;
  export let grainId = 'scoreboard-hero-grain';

  // Exposed so sticky content inside the sections can clear the control bar.
  export let barHeight = 0;
</script>

<div class={`relative overflow-hidden ${heroClass}`}>
  <HeroGrain id={grainId} />
  <div class="relative mx-auto max-w-6xl px-6 pt-10 pb-12 sm:pt-14 sm:pb-16">
    {#if $$slots.brand}
      <div class="mb-6"><slot name="brand" /></div>
    {/if}
    {#if label}
      <p class="text-xs uppercase tracking-widest font-bold text-white/70 mb-3">{label}</p>
    {/if}
    <h1 class="text-4xl sm:text-5xl font-normal text-white max-w-2xl">{title}</h1>
    {#if description}
      <p class="text-base text-white/80 mt-4 max-w-xl leading-relaxed">{description}</p>
    {/if}
  </div>
</div>

{#if $$slots.filters || $$slots.actions}
  <div bind:clientHeight={barHeight} class="sticky top-0 z-40 bg-white border-b border-contour-weakest">
    <div class="mx-auto max-w-7xl flex items-stretch">
      <div class="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide divide-x divide-contour-weakest [&>*]:shrink-0 [&>*]:px-6 [&>*]:py-3">
        <slot name="filters" />
      </div>
      {#if $$slots.actions}
        <div class="shrink-0 flex items-center gap-2 px-6 py-3 border-l border-contour-weakest">
          <slot name="actions" />
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if $$slots.visual}
  <div class="relative bg-surface-weakest">
    <slot name="visual" />
  </div>
{/if}

{#if $$slots.timeline}
  <div class="bg-white border-b border-contour-weakest">
    <slot name="timeline" />
  </div>
{/if}

<div class="mx-auto max-w-7xl px-6">
  <slot />
</div>

{#if $$slots.footer || $$slots['footer-aside']}
  <div class="mx-auto max-w-7xl px-6 pb-16">
    <div class="grid grid-cols-1 md:grid-cols-[minmax(0,15rem)_1fr] gap-6 md:gap-10">
      <div class="flex flex-col gap-4">
        <slot name="footer-aside" />
      </div>
      <div class="min-w-0">
        <slot name="footer" />
      </div>
    </div>
  </div>
{/if}
