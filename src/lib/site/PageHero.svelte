<script>
  export let label = undefined;
  export let title;
  export let description = undefined;
</script>

<div class="bg-theme-700 overflow-hidden relative">
  <svg class="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <filter id="page-hero-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#page-hero-grain)" />
  </svg>
  <div class="relative mx-auto max-w-6xl px-2 sm:px-6 pb-14 sm:pb-20 pt-6 sm:pt-16">
    {#if label}
      <p class="text-xs uppercase tracking-widest font-bold text-sky-300 mb-3">{label}</p>
    {/if}
    <h1 class="text-4xl sm:text-5xl font-normal text-white max-w-2xl">{title}</h1>
    {#if description}
      <p class="text-lg text-sky-100 mt-4 max-w-xl">{description}</p>
    {/if}
  </div>
</div>
