<script>
  import ProvideHero from './ProvideHero.svelte';
  import SectionExplore from '../../landing-page/sections/SectionExplore.svelte';
  import SectionAnalysis from '../../landing-page/sections/SectionAnalysis.svelte';
  import SectionCaseStudies from '../../landing-page/sections/SectionCaseStudies.svelte';
  import SectionProject from '../../landing-page/sections/SectionProject.svelte';
  import { PATH_IMPACT, PATH_AVOID } from '$config';
  import { HEADER_CLASS } from '$stores/state';
  import { onMount, onDestroy } from 'svelte';

  onMount(() => HEADER_CLASS.set('bg-[#1F2B59] border-petrol-800/50'));
  onDestroy(() => HEADER_CLASS.set(''));

  export let data;
  $: ({ caseStudies } = data);

  const avoidCard = {
    path: `${PATH_IMPACT}/${PATH_AVOID}`,
    image: '/img/emission-scenarios.png',
    imageAlt: 'Chart showing compatible scenarios and impact levels',
    description:
      'Avoiding future impacts explores which scenarios minimise the risk from certain impacts in cities and their rural surroundings.',
    project: 'Provide',
    geography: 'Cities',
    dataSource: 'CMIP6'
  };
</script>

<ProvideHero />
<div class="mx-auto max-w-7xl lg:px-6">
  <div class="border-x border-dashed border-contour-weakest">
    <SectionExplore heading="Explore climate impacts through the PROVIDE project variables" />
    <SectionAnalysis
      customCards={[avoidCard]}
      customHeading="Explore the tools developed under PROVIDE"
    />
  </div>
</div>
<div class="bg-gold-50 border-t border-contour-weakest py-24">
  <div class="mx-auto max-w-7xl px-6">
    <SectionCaseStudies {caseStudies} />
    <SectionProject />
  </div>
</div>
