<script>
  import { PATH_EXPLORE } from '$config';
  import LinkArrow from '$lib/helper/icons/LinkArrow.svelte';
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

  <div class="max-w-6xl mx-auto px-6 md:px-12 py-20 lg:py-28 min-h-[600px] flex items-center gap-12 relative z-10">

    <!-- Text content -->
    <div class="text-white max-w-lg flex-shrink-0">
      <p class="text-xs tracking-[0.1em] uppercase font-semibold text-theme-200 mb-5">Climate Impacts</p>
      <h1 class="text-5xl lg:text-6xl font-normal leading-[1.05] mb-6">
        Analyzing the future of climate.
      </h1>
      <p class="text-lg text-white mb-10 leading-relaxed max-w-sm font-light">
        Compare scenarios, explore EU risks, and export evidence for your reports.
      </p>
      <button
        on:click={() => goto(`/${PATH_EXPLORE}`)}
        class="inline-flex items-center gap-3 bg-theme-800 text-white font-bold px-4 py-3 text-md rounded-sm hover:bg-theme-900/80 transition-colors"
      >
        Explore data
        <LinkArrow />
      </button>
    </div>

    <!-- Right: illustration -->
    <div class="hidden lg:flex flex-1 justify-end items-center self-end">
      <img src="/img/hero-illustration.svg" alt="" role="presentation" class="max-h-[520px] w-auto object-contain drop-shadow-2xl" />
    </div>

  </div>

</header>
