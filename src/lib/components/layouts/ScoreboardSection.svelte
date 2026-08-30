<script>
  import { kebabCase } from 'lodash-es';

  // One scoreboard section, in either of the two shapes the page uses:
  //
  // `split`   — heading + explainer in the narrow left column, chart on the
  //             right (the indicators view, which carries no index nav).
  // `stacked` — eyebrow + heading full width above the content, for the
  //             article column of the ranking view. `accent` marks the section
  //             the index nav is currently pointing at.
  export let title = undefined;
  export let description = undefined;
  export let eyebrow = undefined;
  export let slug = undefined;
  export let divider = true;
  export let variant = 'split';
  export let accent = false;

  $: id = slug ?? (title ? kebabCase(title) : undefined);
</script>

{#if variant === 'stacked'}
  <section {id} name={id} class="flex flex-col gap-4 py-10 md:py-14 scroll-mt-24 border-contour-weakest" class:border-b={divider}>
    {#if eyebrow}
      <p class="text-xs uppercase tracking-widest font-semibold text-contour-weak">{eyebrow}</p>
    {/if}
    {#if title}
      <h2 class="text-2xl leading-snug text-theme-stronger border-l-2 pl-4 -ml-4 transition-colors" class:border-theme-base={accent} class:border-transparent={!accent}>{title}</h2>
    {/if}
    {#if description}
      <p class="text-sm leading-relaxed text-text-weaker max-w-3xl">{description}</p>
    {/if}
    <slot />
  </section>
{:else}
  <section {id} name={id} class="grid grid-cols-1 md:grid-cols-[minmax(0,15rem)_1fr] gap-6 md:gap-10 py-10 md:py-14 scroll-mt-24 border-contour-weakest" class:border-b={divider}>
    <div class="flex flex-col gap-3">
      {#if title}
        <h2 class="text-2xl leading-snug text-theme-stronger">{title}</h2>
      {/if}
      {#if description}
        <p class="text-sm leading-relaxed text-text-weaker">{description}</p>
      {/if}
      <slot name="aside" />
    </div>
    <div class="min-w-0">
      <slot />
    </div>
  </section>
{/if}
