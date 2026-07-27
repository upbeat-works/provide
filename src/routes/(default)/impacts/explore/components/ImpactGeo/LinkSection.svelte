<script>
  import Study from '$lib/components/icons/Study.svelte';
  import { PATH_ADAPTATION } from '$config';
  import CategoryBadge from '../../../../landing-page/components/CaseStudiesCarousel/CategoryBadge.svelte';
  import { getStrapiImageAtSize } from '$lib/utils/utils';

  export let geography;
  export let caseStudy = null;

  // The case study, when there is one, is about THIS geography — so the label
  // comes from here, not a geo-tree lookup.
  $: hasCaseStudy = Boolean(caseStudy);
</script>

<div class="rounded overflow-hidden {hasCaseStudy ? 'grid grid-cols-[2fr,3fr]' : ''}">
  {#if hasCaseStudy}
    <div class="relative overflow-hidden bg-gray-200 min-h-48">
      {#if caseStudy?.image}
        <img src={getStrapiImageAtSize(caseStudy.image)} alt={caseStudy.image.alternativeText ?? geography.label} class="w-full h-full object-cover" />
      {/if}
      <CategoryBadge category={caseStudy?.category ?? 'CASE STUDY'} />
    </div>
  {/if}
  <div class="bg-surface-weaker flex flex-col divide-y divide-contour-weakest">
    <div class="px-5 py-6 lg:px-7 lg:py-8 flex flex-col gap-4">
      <Study class="h-14 w-14" />
      <div>
        <h4 class="text-lg font-bold mb-1">Using the data</h4>
        <p class="mb-4">Learn more about using our information in adaptation planning and policymaking.</p>
        <a class="text-theme-base font-bold" href="/{PATH_ADAPTATION}#overshoot-proofing-self-assessment-tool">
          Overshoot policy self assessment tool <span class="font-normal text-sm">→</span>
        </a>
      </div>
    </div>
    {#if hasCaseStudy}
      <div class="px-5 py-6 lg:px-7 lg:py-8 flex flex-col gap-2">
        <h4 class="text-lg font-bold">{caseStudy.title}</h4>
        {#if caseStudy?.abstract}
          <p class="text-text-weaker text-sm">{caseStudy.abstract}</p>
        {/if}
        <a class="text-theme-base font-bold mt-2" href="/{PATH_ADAPTATION}/{caseStudy.slug}">
          Read the case study <span class="font-normal text-sm">→</span>
        </a>
      </div>
    {/if}
  </div>
</div>
