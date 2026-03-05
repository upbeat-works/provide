<script>
  import GeographySelection from './GeographySelection/GeographySelection.svelte';
  import IndicatorSelection from './IndicatorSelection/IndicatorSelection.svelte';
  import ControlTabs from './ControlTabs.svelte';
  import SwapButton from './SwapButton.svelte';

  export let showStepLabels = false;

  let mode = 'geography';

  $: geographyStep = mode === 'geography' ? 1 : 2;
  $: indicatorStep = mode === 'geography' ? 2 : 1;

  $: geographyLabel = showStepLabels ? `Step ${geographyStep} - Geography` : 'Geography';
  $: indicatorLabel = showStepLabels ? `Step ${indicatorStep} - Indicator` : 'Indicator';

  function toggleMode() {
    mode = mode === 'geography' ? 'indicator' : 'geography';
  }
</script>

<ControlTabs bind:mode />

<div
  class="grid gap-4 md:gap-6 mt-6 items-center"
  class:md:grid-cols-[1fr_auto_1fr]={true}
  class:grid-cols-1={true}
>
  <div class:order-1={mode === 'geography'} class:order-3={mode === 'indicator'} class:md:order-1={mode === 'geography'} class:md:order-3={mode === 'indicator'}>
    <GeographySelection label={geographyLabel} popperOptions={{ placement: mode === 'geography' ? 'bottom-start' : 'bottom-end' }} />
  </div>

  <div class="hidden md:flex items-center justify-center order-2 pt-8">
    <SwapButton on:click={toggleMode} />
  </div>

  <div class:order-3={mode === 'geography'} class:order-1={mode === 'indicator'} class:md:order-3={mode === 'geography'} class:md:order-1={mode === 'indicator'}>
    <IndicatorSelection label={indicatorLabel} popperOptions={{ placement: mode === 'geography' ? 'bottom-end' : 'bottom-start' }} />
  </div>
</div>
