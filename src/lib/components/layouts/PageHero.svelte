<script>
  import { page } from '$app/stores';
  export let label = undefined;
  export let title;
  export let description = undefined;
  export let className = '';
  export let tabItems = undefined;
</script>

<div class={`overflow-hidden relative ${className || 'bg-theme-700'}`}>
  <svg class="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <filter id="page-hero-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#page-hero-grain)" />
  </svg>
  <div class="relative mx-auto max-w-6xl px-2 sm:px-6 {tabItems ? 'pb-10 sm:pb-14' : 'pb-14 sm:pb-20'} pt-6 sm:pt-16">
    {#if $$slots.label}
      <div class="mb-3"><slot name="label" /></div>
    {:else if label}
      <p class="text-xs uppercase tracking-widest font-bold text-sky-300 mb-3">{label}</p>
    {/if}
    <h1 class="text-4xl sm:text-5xl font-normal text-white max-w-2xl">{title}</h1>
    {#if description}
      <p class="text-lg text-sky-100 mt-4 max-w-xl">{description}</p>
    {/if}
  </div>
  {#if tabItems}
    <div class="relative border-t border-dashed border-white/30">
      <nav class="relative mx-auto max-w-6xl px-2 sm:px-6 flex">
        {#each tabItems as item}
          {@const isActive = $page.url.pathname === item.href}
          <a
            href={item.href}
            class="px-8 py-3 text-base font-normal leading-[150%] text-center border-t-2 -mt-px transition-colors {isActive ? 'border-white text-white' : 'border-transparent text-white/60'}"
          >{item.label}</a>
        {/each}
      </nav>
    </div>
  {/if}
</div>
