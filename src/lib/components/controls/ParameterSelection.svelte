<script>
  import GeographySelection from './GeographySelection/GeographySelection.svelte';
  import IndicatorSelection from './IndicatorSelection.svelte';
  import SwapButton from './components/SwapButton.svelte';
  import { SELECTION_MODE } from '$stores/state.js';

  $: mode = $SELECTION_MODE;

  $: geographyStep = mode === 'geography' ? 1 : 2;
  $: indicatorStep = mode === 'geography' ? 2 : 1;

  $: geographyLabel = `Step ${geographyStep} - Geography`;
  $: indicatorLabel = `Step ${indicatorStep} - Indicator`;

  function toggleMode() {
    SELECTION_MODE.set(mode === 'geography' ? 'indicator' : 'geography');
  }
</script>

<div class="bg-slate-50 py-6 z-50">
  <div
    class="grid gap-4 md:gap-6 items-center mx-auto max-w-7xl px-6"
    class:md:grid-cols-[1fr_auto_1fr]={true}
    class:grid-cols-1={true}
  >
    <div class:order-1={mode === 'geography'} class:order-3={mode === 'indicator'} class:md:order-1={mode === 'geography'} class:md:order-3={mode === 'indicator'}>
      <GeographySelection label={geographyLabel} />
    </div>

    <div class="hidden md:flex items-center justify-center order-2 pt-8">
      <SwapButton on:click={toggleMode} />
    </div>

    <div class:order-3={mode === 'geography'} class:order-1={mode === 'indicator'} class:md:order-3={mode === 'geography'} class:md:order-1={mode === 'indicator'}>
      <IndicatorSelection label={indicatorLabel} />
    </div>
  </div>
</div>
