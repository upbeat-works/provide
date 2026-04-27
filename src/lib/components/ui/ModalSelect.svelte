<script>
  import { Dialog, DialogOverlay } from '@rgossiaux/svelte-headlessui';

  export let panelClass = '';
  export let isOpen = false;
</script>

<slot name="trigger" open={isOpen} toggle={() => (isOpen = !isOpen)} />

<Dialog open={isOpen} on:close={() => (isOpen = false)} class="relative z-50">
  <DialogOverlay class="fixed inset-0 bg-black/40" />
  <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
  <div class="fixed inset-0 flex items-center justify-center p-4" on:click={() => (isOpen = false)}>
    <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
    <div class={`${panelClass} relative bg-surface-base rounded overflow-hidden border border-contour-weakest shadow-xl w-full max-h-[95vh] flex flex-col`} on:click|stopPropagation>
      <div class="absolute top-3 right-3 z-10">
        <button on:click={() => (isOpen = false)} aria-label="Close" class="text-contour-weak hover:text-theme-base transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <slot />
    </div>
  </div>
</Dialog>
