<script>
  let clazz = '';
  export { clazz as class };
  export let label;
  export let uid;
  export let icon;
  export let selected;
  export let hovered;
  // 'md' is the geography tree's roomier row, where the highlight band and the
  // accent bar carry the selection; 'sm' is the compact indicator list, which
  // marks the selected row in bold instead.
  export let size = 'sm';
  $: rowClass = size === 'md' ? 'text-[15px] py-1.5 gap-2.5 text-theme-stronger' : 'text-sm py-1 gap-1';
  $: emphasize = selected && size !== 'md';
  $: isWindows = /windows/i.test(navigator.userAgent);
</script>

<span
  role="button"
  tabindex="0"
  class:text-theme-base={emphasize}
  class:border-r-3={selected}
  class:bg-surface-weaker={selected}
  class="{rowClass} px-5 hover:bg-surface-weaker focus:bg-surface-weaker focus:outline-none whitespace-nowrap flex cursor-pointer border-theme-base {clazz}"
  on:focus={() => (hovered = uid)}
  on:mouseover={() => (hovered = uid)}
  on:mouseleave={() => (hovered = null)}
  on:blur={() => (hovered = null)}
  title={label}
>
  {#if icon && !isWindows}<i class="not-italic font-emoji font-normal" aria-hidden role="presentation">{icon}</i>{/if}
  <span class:font-bold={emphasize} class="truncate">{@html label}</span>
</span>
