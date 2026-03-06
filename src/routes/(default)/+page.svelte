<script>
  import SectionHero from './landing-page/SectionHero.svelte';
  import SectionExplore from './landing-page/SectionExplore.svelte';
  import SectionAnalysis from './landing-page/SectionAnalysis.svelte';
  import SectionCaseStudies from './landing-page/SectionCaseStudies.svelte';
  import SectionProject from './landing-page/SectionProject.svelte';

  export let data;
  $: ({ stories, caseStudies, videos } = data);
</script>

<SectionHero {stories} />
<div class="mx-auto max-w-7xl lg:px-6">
  <div class="border-x border-dashed border-contour-weakest">
    <SectionExplore />
    <SectionAnalysis />
  </div>
</div>
<div class="bg-gold-50 border-t border-contour-weakest py-24">
  <div class="mx-auto max-w-7xl px-6">
    <SectionCaseStudies {caseStudies} />
    <SectionProject />
  </div>
</div>
