<script>
  import CaseStudyCard from '../landing-page/components/CaseStudiesCarousel/CaseStudyCard.svelte';

  export let data;
</script>

<!-- Hero -->
<div class="bg-grass-25 border-b border-contour-weakest">
  <div class="max-w-6xl mx-auto px-6 py-20 text-center">
    <h1 class="text-5xl font-normal text-theme-stronger mb-5">Case studies</h1>
    <p class="text-lg text-text-weaker max-w-2xl mx-auto">
      Real-world examples of how climate risk dashboard data has been used to support adaptation planning across cities and regions.
    </p>
  </div>
</div>

<!-- Card grid -->
<div class="max-w-6xl mx-auto px-6 py-12">
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each data.caseStudies as study}
      <CaseStudyCard {study} />
    {/each}
  </div>
</div>
