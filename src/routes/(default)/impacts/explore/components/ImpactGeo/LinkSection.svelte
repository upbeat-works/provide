<script>
  import Study from '$lib/components/icons/Study.svelte';
  import { GEOGRAPHY_TYPE_CITY, PATH_ADAPTATION } from '$config';
  import { GEOGRAPHIES } from '$stores/meta.js';
  import CategoryBadge from '../../../../landing-page/components/CaseStudiesCarousel/CategoryBadge.svelte';
  import { getStrapiImageAtSize } from '$lib/utils/utils';

  export let geography;
  export let caseStudy = null;

  $: isCity = geography.geographyType === GEOGRAPHY_TYPE_CITY;
  $: caseStudyGeography = isCity && $GEOGRAPHIES[GEOGRAPHY_TYPE_CITY].find((d) => d.uid === geography.adaptationCaseStudy);
</script>

<div class="rounded overflow-hidden {caseStudyGeography ? 'grid grid-cols-[2fr,3fr]' : ''}">
  {#if caseStudyGeography}
    <div class="relative overflow-hidden bg-gray-200 min-h-48">
      {#if caseStudy?.image}
        <img
          src={getStrapiImageAtSize(caseStudy.image)}
          alt={caseStudy.image.alternativeText ?? caseStudyGeography.label}
          class="w-full h-full object-cover"
        />
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
    {#if caseStudyGeography}
      <div class="px-5 py-6 lg:px-7 lg:py-8 flex flex-col gap-2">
        <h4 class="text-lg font-bold">{caseStudyGeography.label}</h4>
        {#if caseStudy?.abstract}
          <p class="text-text-weaker text-sm">{caseStudy.abstract}</p>
        {/if}
        <a class="text-theme-base font-bold mt-2" href="/{PATH_ADAPTATION}/{caseStudyGeography.uid}">
          See {caseStudyGeography.label} case study <span class="font-normal text-sm">→</span>
        </a>
      </div>
    {/if}
  </div>
</div>
