<script>
  export let variant = 'primary'; // 'primary' | 'secondary' | 'ghost'
  export let disabled = false;
  export let href = undefined;
  export let type = 'button';

  let className = '';
  export { className as class };

  const base =
    'inline-flex items-center gap-2 px-4 py-2 rounded-sm font-bold text-sm transition-colors';

  const variants = {
    primary:
      'bg-theme-800 text-white hover:enabled:bg-theme-900/80 disabled:bg-contour-weakest disabled:text-text-weaker disabled:cursor-not-allowed',
    secondary:
      'bg-surface-weaker text-theme-base hover:enabled:bg-surface-weakest disabled:opacity-40 disabled:cursor-not-allowed',
    ghost:
      'text-theme-base hover:enabled:bg-surface-weaker disabled:opacity-40 disabled:cursor-not-allowed',
  };
</script>

{#if href && !disabled}
  <a {href} class="{base} {variants[variant]} {className}">
    <slot />
  </a>
{:else}
  <button {type} {disabled} class="{base} {variants[variant]} {className}" on:click>
    <slot />
  </button>
{/if}
