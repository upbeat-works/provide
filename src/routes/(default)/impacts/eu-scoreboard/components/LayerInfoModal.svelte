<script>
  import { Dialog, DialogOverlay, DialogTitle } from '@rgossiaux/svelte-headlessui';

  // What the map is drawing, opened from the legend's info button. Sized to its
  // content rather than to the viewport — unlike ModalSelect, which fills the
  // screen because it holds a searchable list; this is a short, fixed read.
  export let isOpen = false;
  export let title;
  export let parts = [];
  export let rows = [];
</script>

<Dialog open={isOpen} on:close={() => (isOpen = false)} class="relative z-50">
  <DialogOverlay class="fixed inset-0 bg-black/40" />
  <div class="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-[8vh]">
    <div class="relative w-full max-w-lg rounded bg-surface-base px-8 py-7 shadow-xl">
      <button
        type="button"
        on:click={() => (isOpen = false)}
        aria-label="Close"
        class="absolute right-5 top-5 text-contour-weak transition-colors hover:text-theme-base"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>

      <p class="text-xs font-semibold uppercase tracking-wider text-theme-base">Layer metadata</p>
      <DialogTitle class="mt-3 pr-8 text-2xl font-semibold leading-tight text-theme-stronger">{title}</DialogTitle>

      {#if parts.length}
        <p class="mt-2 text-sm text-text-weaker">
          {#each parts as { label }, i}{#if i > 0}<span class="mx-1">·</span>{/if}{label}{/each}
        </p>
      {/if}

      {#if rows.length}
        <!-- Two to a row, so a pair reads across (Variable / Unit) the way the
             facets pair up, and collapsing to one column on a narrow screen
             keeps each label with its own value. -->
        <dl class="mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {#each rows as { label, value }}
            <div class="border-t border-contour-weakest py-3">
              <dt class="text-sm text-text-weaker">{label}</dt>
              <dd class="mt-0.5 text-sm font-semibold text-theme-stronger">{value}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  </div>
</Dialog>
