<script>
  export let variant = 'primary'; // 'primary' | 'secondary' | 'ghost' | 'outline'
  export let size = 'base'; // 'base' | 'sm'
  export let disabled = false;
  export let href = undefined;
  export let type = 'button';

  let className = '';
  export { className as class };

  const base = 'inline-flex items-center rounded-sm font-semibold transition-colors';

  const sizes = {
    base: 'gap-2 px-4 py-2 text-base',
    sm: 'gap-1.5 px-3 py-1.5 text-sm',
  };

  const variants = {
    primary: 'bg-theme-800 text-white hover:enabled:bg-theme-900/80 disabled:bg-contour-weakest disabled:text-text-weaker disabled:cursor-not-allowed',
    secondary: 'bg-surface-weaker text-theme-base hover:enabled:bg-theme-base hover:enabled:text-white disabled:opacity-40 disabled:cursor-not-allowed',
    ghost: 'text-theme-base hover:enabled:bg-surface-weaker disabled:opacity-40 disabled:cursor-not-allowed',
    outline:
      'bg-surface-base text-theme-base border border-theme-weakest hover:enabled:bg-theme-base hover:enabled:border-theme-base hover:enabled:text-white disabled:opacity-40 disabled:cursor-not-allowed',
  };

  const linkVariants = {
    primary: 'bg-theme-800 text-white hover:bg-theme-900/80',
    secondary: 'bg-surface-weaker text-theme-base hover:bg-theme-base hover:text-white',
    ghost: 'text-theme-base hover:bg-surface-weaker',
    outline: 'bg-surface-base text-theme-base border border-theme-weakest hover:bg-theme-base hover:border-theme-base hover:text-white',
  };
</script>

{#if href && !disabled}
  <a {href} class="{base} {sizes[size]} {linkVariants[variant]} {className}" {...$$restProps}>
    <slot />
  </a>
{:else}
  <button {type} {disabled} class="{base} {sizes[size]} {variants[variant]} {className}" on:click {...$$restProps}>
    <slot />
  </button>
{/if}
