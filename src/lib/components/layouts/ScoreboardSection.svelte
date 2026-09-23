<script>
  import { kebabCase } from 'lodash-es';

  // One section of a scoreboard view's article column: eyebrow + heading above
  // the content, with the index nav beside it in the layout's sidebar. Which
  // section is in view is marked on the index itself, the way the site's other
  // side navs do it — not with a rule beside the heading.
  export let title = undefined;
  export let description = undefined;
  export let eyebrow = undefined;
  export let slug = undefined;
  export let divider = true;

  $: id = slug ?? (title ? kebabCase(title) : undefined);
</script>

<section {id} name={id} class="flex flex-col gap-4 py-10 md:py-14 scroll-mt-24 border-contour-weakest" class:border-b={divider}>
  {#if eyebrow}
    <p class="text-xs uppercase tracking-widest font-semibold text-contour-weak">{eyebrow}</p>
  {/if}
  {#if title}
    <h2 class="text-2xl leading-snug text-theme-stronger">{title}</h2>
  {/if}
  {#if description}
    <p class="text-sm leading-relaxed text-text-weaker max-w-3xl">{description}</p>
  {/if}
  <slot />
</section>
