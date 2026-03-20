<script>
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';
  import { kebabCase } from 'lodash-es';

  export let title;
  export let subtitle = undefined;
  export let content = undefined;
  export let slug = undefined;
  export let as = 'h2';

  $: id = slug ?? kebabCase(title);
</script>

<svelte:element
  this={as}
  {id}
  name={id}
  class="text-theme-stronger scroll-mt-4 mb-2 mt-4 first:mt-0"
  class:text-2xl={as === 'h2'}
  class:text-xl={as === 'h3'}
  class:text-lg={as === 'h4'}
>
  {title}
</svelte:element>

{#if subtitle}
  <p class="text-sm text-text-weaker mb-2">{subtitle}</p>
{/if}

{#if content}
  <HtmlContent {content} />
{/if}
