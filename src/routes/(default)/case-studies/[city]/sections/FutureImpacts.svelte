<script>
  import Select from '$lib/components/ui/Select.svelte';
  import { getStrapiImageAtSize } from '$lib/utils/utils';
  import ExplorerLink from './ExplorerLink.svelte';
  import _ from 'lodash-es';
  import { writable } from 'svelte/store';
  export let explorerUrl;
  export let impactGeoDescription;
  export let impactTimeDescription;
  export let impactGeoSnapshots;
  export let impactTimeSnapshots;

  $: indicators = _.uniqBy(impactTimeSnapshots, 'indicator').map((d) => d.indicator);
  $: indicator = writable(indicators[0].uid);

  $: years = _.uniqBy(impactGeoSnapshots, 'year').map((d) => ({ uid: d.year, label: d.year }));
  $: year = writable(years[0].uid);

  $: timeSelection = _.find(impactTimeSnapshots, (d) => d.indicator.uid === $indicator);
  $: geoSelection = _.find(impactGeoSnapshots, (d) => d.indicator.uid === $indicator && d.year === $year);
</script>

<div class="max-w-3xl">
  {#if indicators.length > 1}
    <div class="mb-6">
      <Select boxed label="Indicator" options={indicators.map((d) => ({ value: d.uid, label: d.label }))} bind:value={$indicator} />
    </div>
  {/if}
  <figure class="mb-10">
    <img class="mb-8" src={getStrapiImageAtSize(timeSelection.image)} alt={timeSelection.image?.alternativeText} />
    <figcaption class="flex flex-col items-start gap-6">
      <div class="text-sm text-text-weaker max-w-[40em]">{impactTimeDescription}</div>
      <ExplorerLink href={explorerUrl} />
    </figcaption>
  </figure>

  {#if years.length > 1}
    <div class="mb-4">
      <Select boxed label="Year" options={years.map((d) => ({ value: d.uid, label: d.label }))} bind:value={$year} />
    </div>
  {/if}
  <figure>
    <img class="mb-8" src={getStrapiImageAtSize(geoSelection.image)} alt={timeSelection.image?.alternativeText} />
    <figcaption class="flex flex-col items-start gap-6">
      <div class="text-sm text-text-weaker max-w-[40em]">{impactGeoDescription}</div>
      <ExplorerLink href={explorerUrl} />
    </figcaption>
  </figure>
</div>
