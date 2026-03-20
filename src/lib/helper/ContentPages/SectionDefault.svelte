<script>
  import HtmlContent from '$lib/helper/HtmlContent.svelte';
  import { kebabCase } from 'lodash-es';
  export let title;
  export let subtitle;
  export let content = null;
  export let slug;
</script>

{#if title}
  <h2 id={slug || kebabCase(title)} name={slug} class="scroll-mt-4 font-semibold text-2xl text-theme-stronger mb-3 mt-2 first:mt-0">{title}</h2>
{/if}
{#if subtitle}
  <p class="text-theme-weaker">{subtitle}</p>
{/if}
<HtmlContent {content} />
