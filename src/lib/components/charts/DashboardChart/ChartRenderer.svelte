<script>
  import { getContext } from 'svelte';
  import { readable } from 'svelte/store';
  import Message from '../../ui/Message.svelte';
  import { buildChartModel } from './model';
  import CartesianChart from './CartesianChart.svelte';
  import TableChart from './TableChart.svelte';

  export let contract;

  const fallbackPalette = ['#51a6d3', '#a7b451', '#e9974a', '#276789', '#646c31', '#8c5b2c'];
  const theme = getContext('theme') ?? readable(undefined);

  $: palette = (() => {
    const category = $theme?.color?.category;
    if (!category) {
      return fallbackPalette;
    }
    return ['base', 'strong', 'weak'].flatMap((strength) => Object.values(category[strength] ?? {}));
  })();
  $: model = buildChartModel(contract, palette);
</script>

{#if contract.data.values.length === 0}
  <Message headline="There is no data for this chart" warningSizeSmall={true} />
{:else if model.layout === 'cartesian'}
  <CartesianChart {model} />
{:else}
  <TableChart {model} />
{/if}
