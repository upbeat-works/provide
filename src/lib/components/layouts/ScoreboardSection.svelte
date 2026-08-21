<script>
  import { kebabCase } from 'lodash-es';

  // One scoreboard row: heading + explainer in the narrow left column, the
  // chart (and whatever it brings with it — legend, download links) on the
  // right. Divider matches the section rules in the mockup.
  export let title = undefined;
  export let description = undefined;
  export let slug = undefined;
  export let divider = true;

  $: id = slug ?? (title ? kebabCase(title) : undefined);
</script>

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
