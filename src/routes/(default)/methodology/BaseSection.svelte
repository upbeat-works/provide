<script>
  import HtmlContent from '$lib/helper/HtmlContent.svelte';
  export let slug;
  export let title;
  export let content;
</script>

<h3 id={slug} name={slug} class="scroll-mt-4 font-bold text-xl mb-2 mt-4 first:mt-0">{title}</h3>
<HtmlContent {content} />
