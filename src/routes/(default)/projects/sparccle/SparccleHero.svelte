<script>
  import HeroGrain from '$lib/components/ui/HeroGrain.svelte';
  import { CLASS_SCOREBOARD_BG } from '$config';
</script>

<header class={`relative overflow-hidden ${CLASS_SCOREBOARD_BG}`}>
  <HeroGrain id="sparccle-hero-grain" />
  <div class="relative z-10 mx-auto max-w-6xl px-6 py-14 md:py-20 lg:py-28">
    <div class="max-w-2xl text-white">
      <img src="/img/sparccle-logo-white.svg" alt="SPARCCLE" class="mb-8 h-8 w-auto" />
      <h1 class="mb-8 text-3xl font-normal leading-[1.1] md:text-4xl lg:text-5xl">SPARCCLE's contribution to the Climate Risk Dashboard</h1>
      <p class="max-w-2xl font-light leading-relaxed text-white">
        Explore climate risk across Europe. The EU Scoreboard brings together maps, rankings and charts so you can compare places, scenarios and years.
      </p>
    </div>
  </div>
</header>
