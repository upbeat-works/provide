<script>
  // Avoid's By Geography / By Indicator selector — mirrors the shared
  // ParameterSelection layout, bound to the isolated AVOID_* stores.
  import AvoidGeographySelection from './AvoidGeographySelection.svelte';
  import AvoidIndicatorSelection from './AvoidIndicatorSelection.svelte';
  import SwapButton from '$lib/components/controls/components/SwapButton.svelte';
  import { AVOID_SELECTION_MODE } from '$stores/avoid-catalog.js';

  $: mode = $AVOID_SELECTION_MODE;
  $: geographyStep = mode === 'geography' ? 1 : 2;
  $: indicatorStep = mode === 'geography' ? 2 : 1;

  function toggleMode() {
    AVOID_SELECTION_MODE.set(mode === 'geography' ? 'indicator' : 'geography');
  }
</script>

<div class="bg-slate-50 py-6 z-50">
  <div class="grid gap-4 md:gap-6 items-center mx-auto max-w-7xl px-6 grid-cols-1 md:grid-cols-[1fr_auto_1fr]">
    <div class:order-1={mode === 'geography'} class:order-3={mode === 'indicator'} class:md:order-1={mode === 'geography'} class:md:order-3={mode === 'indicator'}>
      <AvoidGeographySelection label={`Step ${geographyStep} - Geography`} />
    </div>

    <div class="hidden md:flex items-center justify-center order-2 pt-8">
      <SwapButton on:click={toggleMode} />
    </div>

    <div class:order-3={mode === 'geography'} class:order-1={mode === 'indicator'} class:md:order-3={mode === 'geography'} class:md:order-1={mode === 'indicator'}>
      <AvoidIndicatorSelection label={`Step ${indicatorStep} - Indicator`} />
    </div>
  </div>
</div>
