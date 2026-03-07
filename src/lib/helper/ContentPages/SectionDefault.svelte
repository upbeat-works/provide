<script>
  import HtmlContent from '$lib/helper/HtmlContent.svelte';
  import { kebabCase } from 'lodash-es';
  export let title;
  export let subtitle;
  export let content = null;
  export let slug;
</script>

{#if title}
  <h2 id={slug || kebabCase(title)} name={slug} class="scroll-mt-4 font-bold text-3xl mb-2 mt-4 first-of-type:mt-0">{title}</h2>
{/if}
{#if subtitle}
  <p class="text-text-weaker">{subtitle}</p>
{/if}
<HtmlContent {content} />
