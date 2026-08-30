<script>
  import { kebabCase } from 'lodash-es';

  // One section of a scoreboard view's article column: eyebrow + heading above
  // the content, with the index nav beside it in the layout's sidebar. `accent`
  // marks the section the index is currently pointing at.
  export let title = undefined;
  export let description = undefined;
  export let eyebrow = undefined;
  export let slug = undefined;
  export let divider = true;
  export let accent = false;

  $: id = slug ?? (title ? kebabCase(title) : undefined);
</script>

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
