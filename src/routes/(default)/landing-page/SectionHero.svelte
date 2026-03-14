<script>
  import { PATH_IMPACT, PATH_EXPLORE } from '$config';
  import LinkArrow from '$lib/helper/icons/LinkArrow.svelte';
  import Button from '$lib/controls/Button/Button.svelte';
  import { goto } from '$app/navigation';
</script>

<header class="bg-theme-700 overflow-hidden relative">

  <!-- Grain texture overlay -->
  <svg class="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <filter id="hero-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#hero-grain)" />
  </svg>

  <!-- Tile background -->
  <img src="/img/hero-bg-tiles.svg" alt="" aria-hidden="true" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />

  <div class="max-w-6xl mx-auto px-6 py-14 md:py-20 lg:py-28 md:min-h-[600px] flex flex-col sm:flex-row items-center gap-8 lg:gap-12 relative z-10">

    <!-- Text content -->
    <div class="text-white flex-1 min-w-0">
      <p class="text-xs tracking-[0.1em] uppercase font-semibold text-theme-200 mb-5">Climate Impacts</p>
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05] mb-6">
        Analyzing the future of climate.
      </h1>
      <p class="text-lg text-white mb-10 leading-relaxed max-w-sm font-light">
        Compare scenarios, explore EU risks, and export evidence for your reports.
      </p>
      <Button on:click={() => goto(`/${PATH_IMPACT}/${PATH_EXPLORE}`)}>
        Explore data
        <LinkArrow />
      </Button>
    </div>

    <!-- Right: illustration -->
    <div class="flex w-full sm:w-auto sm:flex-shrink-0 justify-center sm:justify-end items-center lg:self-end">
      <img src="/img/hero-illustration.png" alt="" role="presentation" class="w-full sm:w-auto sm:max-h-[220px] md:max-h-[380px] lg:max-h-[520px] object-contain drop-shadow-2xl" />
    </div>

  </div>

</header>
