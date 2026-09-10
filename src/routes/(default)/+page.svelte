<script>
  import SectionHero from './landing-page/sections/SectionHero.svelte';
  import SectionExplore from './landing-page/sections/SectionExplore.svelte';
  import SectionAnalysis from './landing-page/sections/SectionAnalysis.svelte';
  import SectionCaseStudies from './landing-page/sections/SectionCaseStudies.svelte';
  import SectionProject from './landing-page/sections/SectionProject.svelte';
  import { onMount } from 'svelte';
  import { catalogFlow } from '$stores/catalog-flow.js';
  import { RUNTIME_GEOGRAPHIES } from '$stores/meta.js';
  import { RUNTIME_CATALOG_SELECTION } from '$stores/state.js';

  export let data;
  $: ({ projectSection } = data);
  $: caseStudies = data.caseStudies.map((study) => {
    const geography = $RUNTIME_GEOGRAPHIES.geographies.find((entry) => entry.geoId === study.city.uid || entry.id === study.city.uid);
    if (!geography) return study;
    return { ...study, city: { ...study.city, label: geography.label } };
  });

  onMount(() => {
    void initializeCatalog();
  });

  async function initializeCatalog() {
    await catalogFlow.start();
    const indicator = $RUNTIME_CATALOG_SELECTION.indicator;
    if (indicator) await catalogFlow.chooseIndicator(indicator);
  }
</script>

<SectionHero />
<div class="mx-auto max-w-7xl lg:px-6">
  <div class="border-x border-dashed border-contour-weakest">
    <SectionExplore />
    <SectionAnalysis />
  </div>
</div>
<div class="bg-gold-50 border-t border-contour-weakest py-24">
  <div class="mx-auto max-w-7xl px-6">
    <SectionCaseStudies {caseStudies} />
    <SectionProject content={projectSection} />
  </div>
</div>
