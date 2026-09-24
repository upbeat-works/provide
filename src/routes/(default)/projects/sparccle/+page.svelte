<script>
  import SparccleHero from './SparccleHero.svelte';
  import SectionExplore from '../../landing-page/sections/SectionExplore.svelte';
  import SectionAnalysis from '../../landing-page/sections/SectionAnalysis.svelte';
  import SectionCaseStudies from '../../landing-page/sections/SectionCaseStudies.svelte';
  import SectionProject from '../../landing-page/sections/SectionProject.svelte';
  import { PATH_EU_SCOREBOARD, PATH_IMPACT } from '$config';

  export let data;

  const scoreboardCard = {
    path: `/${PATH_IMPACT}/${PATH_EU_SCOREBOARD}`,
    image: '/img/eu-flag.svg',
    imageAlt: 'European Union flag',
    description: 'The EU Scoreboard shows how climate risk differs across European countries and regions through maps, rankings and charts.',
    project: 'SPARCCLE',
    geography: 'Europe',
    dataSource: 'SPARCCLE',
  };
</script>

<SparccleHero />
<div class="mx-auto max-w-7xl lg:px-6">
  <div class="border-x border-dashed border-contour-weakest">
    <SectionExplore />
    <SectionAnalysis customCards={[scoreboardCard]} customHeading="Explore the tools developed under SPARCCLE" />
  </div>
</div>
<div class="border-t border-contour-weakest bg-gold-50 py-24">
  <div class="mx-auto max-w-7xl px-6">
    <SectionCaseStudies caseStudies={data.caseStudies ?? []} />
    <SectionProject content={data.projectSection} />
  </div>
</div>
