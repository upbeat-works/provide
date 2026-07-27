<script>
  // One card of the "About the project" block. `items` is empty for the intro
  // card — only the highlights card has them.
  export let text = '';
  export let items = [];
  export let link = null;
</script>

<div class="flex flex-col">
  <div class="h-4 border-x border-dashed border-contour-weakest"></div>
  <div class="border border-contour-weakest p-6 flex flex-col flex-grow rounded-sm">
    <div class="flex-grow">
      {#if text}
        <div class="landing-panel-text text-base text-text-base leading-relaxed mb-6">
          {@html text}
        </div>
      {/if}

      {#if items.length}
        <div class="space-y-4">
          {#each items as item}
            <div>
              <h3 class="text-sm font-medium text-theme-base uppercase tracking-wide">{item.title}</h3>
              <p class="text-sm text-text-base">{item.description}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if link}
      <a href={link.url} class="text-theme-base hover:underline font-medium mt-8 block">{link.label}</a>
    {/if}
  </div>
  <div class="h-4 border-x border-dashed border-contour-weakest"></div>
</div>

<style>
  /* The card body is editor-authored markdown, so its links and lists are styled
     here rather than by classes in the markup — hence :global on the whole
     selector, the .landing-panel-text wrapper being the scope. */
  :global(.landing-panel-text a) {
    @apply text-theme-base hover:underline;
  }

  :global(.landing-panel-text p + p) {
    @apply mt-4;
  }

  :global(.landing-panel-text ul) {
    @apply list-disc ml-5 my-2;
  }

  :global(.landing-panel-text li) {
    @apply mt-1;
  }
</style>
