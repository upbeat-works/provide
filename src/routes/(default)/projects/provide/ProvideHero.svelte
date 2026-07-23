<script>
  import HeroGrain from '$lib/components/ui/HeroGrain.svelte';
</script>

<header class="bg-[#163A52] overflow-hidden relative">

  <!-- Grain texture overlay -->
  <HeroGrain id="provide-hero-grain" />

  <div class="max-w-6xl mx-auto px-6 py-14 md:py-20 lg:py-28 relative z-10">
    <div class="text-white max-w-2xl">
      <img src="/img/provide-logo-white.png" alt="PROVIDE" class="h-7 mb-8" />
      <h1 class="text-3xl md:text-4xl lg:text-5xl font-normal leading-[1.1] mb-8">
        Provide's contribution to the<br />Climate Risk Dashboard
      </h1>
      <div class="space-y-4 text-white font-light leading-relaxed max-w-2xl">
        <p>
          The PROVIDE project aimed to better understand and illustrate the potential environmental and
          economic impacts that would result from overshooting the 1.5°C temperature goal set out in the
          Paris Agreement, to better equip researchers and adaptation practitioners.
        </p>
        <p>
          Moving beyond a limited set of climate scenarios, the PROVIDE approach allows users to make
          impact thresholds the starting point for analysis and adaptation planning.
        </p>
        <p>
          The initial Climate Risk Dashboard was developed under the PROVIDE project.
        </p>
      </div>
    </div>
  </div>

</header>
