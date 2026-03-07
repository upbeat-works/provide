<script>
  import GeographySelection from './GeographySelection/GeographySelection.svelte';
  import IndicatorSelection from './IndicatorSelection/IndicatorSelection.svelte';
  import ControlTabs from './ControlTabs.svelte';
  import SwapButton from './SwapButton.svelte';
  import { SELECTION_MODE } from '$stores/state.js';

  export let showStepLabels = false;
  export let sticky = false;

  let mode = $SELECTION_MODE;

  // Sync local mode variable to the store so other components can react to it
  $: SELECTION_MODE.set(mode);

  $: geographyStep = mode === 'geography' ? 1 : 2;
  $: indicatorStep = mode === 'geography' ? 2 : 1;

  $: geographyLabel = showStepLabels ? `Step ${geographyStep} - Geography` : 'Geography';
  $: indicatorLabel = showStepLabels ? `Step ${indicatorStep} - Indicator` : 'Indicator';

  function toggleMode() {
    mode = mode === 'geography' ? 'indicator' : 'geography';
  }
</script>

<div class="bg-slate-50 pt-8">
  <div class="mx-auto max-w-7xl px-2 sm:px-6">
    <ControlTabs bind:mode />
  </div>
</div>

<hr class="border-t border-contour-weakest" />

<div class="bg-slate-50 py-8" class:sticky={sticky} class:top-0={sticky} class:z-40={sticky} class:border-b={sticky} class:border-contour-weakest={sticky}>
  <div
    class="grid gap-4 md:gap-6 items-center mx-auto max-w-7xl px-2 sm:px-6"
    class:md:grid-cols-[1fr_auto_1fr]={true}
    class:grid-cols-1={true}
  >
    <div class="order-1" class:md:order-1={mode === 'geography'} class:md:order-3={mode === 'indicator'}>
      <GeographySelection label={geographyLabel} />
    </div>

    <div class="hidden md:flex items-center justify-center order-2 pt-8">
      <SwapButton on:click={toggleMode} />
    </div>

    <div class="order-3" class:md:order-3={mode === 'geography'} class:md:order-1={mode === 'indicator'}>
      <IndicatorSelection label={indicatorLabel} />
    </div>
  </div>
</div>
