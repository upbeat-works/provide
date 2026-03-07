<script>
  import HtmlContent from '$lib/helper/HtmlContent.svelte';
  export let title;
  export let content = null;
  export let slug;
</script>

<h2 id={slug} name={slug} class="scroll-mt-4 font-bold text-2xl mb-2 mt-4 first-of-type:mt-0">{title}</h2>
<HtmlContent {content} />
