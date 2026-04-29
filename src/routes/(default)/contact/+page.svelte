<script>
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';
  import { LABEL_CONTACT } from '$config';
  export let data;

  $: ({ text } = data);
</script>

<div class="max-w-7xl mx-auto md:px-6">
  <div class="md:grid md:grid-cols-[3fr_2fr] min-h-screen border-l border-r border-dashed border-contour-weakest">
    <div class="flex flex-col">
      <div class="bg-surface-weaker px-6 py-20">
        <p class="uppercase text-xs tracking-widest font-bold text-theme-base mb-4">{LABEL_CONTACT}</p>
        <h1 class="text-5xl font-bold mb-6">Get in touch</h1>
        <span class="text-lg">Did you spot a bug or want to collaborate? We are always happy to hear from you.</span>
      </div>
      <div class="px-6 py-20">
        <HtmlContent content={text} />
      </div>
    </div>
    <div class="hidden md:block">
      <img
        src="/img/contact-bg.png"
        alt=""
        aria-hidden="true"
        class="w-full object-cover"
      />
    </div>
  </div>
</div>
