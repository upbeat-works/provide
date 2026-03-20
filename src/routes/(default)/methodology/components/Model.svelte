<script>
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';

  export let slug;
  export let title;
  export let content;

</script>

<h3 id={slug} name={slug} class="scroll-mt-4 font-semibold text-xl mb-2 mt-4 first:mt-0">
  {title}
</h3>
{#each content as { slug, title, description }}
  {#if title}
    <h4 id={slug} name={slug} class="scroll-mt-4 font-semibold text-lg mb-2 mt-4 first:mt-0">
      {title}
    </h4>
  {/if}
  <HtmlContent content={description} />
{/each}
