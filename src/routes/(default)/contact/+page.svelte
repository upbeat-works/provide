<script>
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';
  import { LABEL_CONTACT } from '$config';
  export let data;

  $: ({ text } = data);
</script>

<div class="bg-surface-weaker max-w-[100vw] overflow-hidden">
  <div class="mx-auto px-2 sm:px-6 flex flex-col pt-20 pb-14 max-w-4xl">
    <div class="flex flex-col gap-y-3.5">
      <h1 class="text-5xl font-bold max-w-2xl">{LABEL_CONTACT}</h1>
      <span class="max-w-xl text-lg">Did you spot a bug or want to collaborate? We are always happy to hear from you.</span>
    </div>
  </div>
</div>

<div class="grid grid-rows-[auto_auto] grid-cols-1 mx-auto max-w-4xl px-6 my-12">
  <HtmlContent content={text} />
</div>
