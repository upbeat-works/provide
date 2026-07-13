<script>
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import Outro from '../sections/Outro.svelte';
  import AvoidingImpacts from './sections/AvoidingImpacts.svelte';
  import FutureImpacts from './sections/FutureImpacts.svelte';
  import ImageSlider from './sections/ImageSlider.svelte';
  import SidebarMetadata from './sections/SidebarMetadata.svelte';
  import CaseStudyCard from '../../landing-page/components/CaseStudiesCarousel/CaseStudyCard.svelte';
  import { PATH_ADAPTATION } from '$src/config.js';
  import { getStrapiImageAtSize } from '$lib/utils/utils';
  import Arrow from '$lib/components/icons/Arrow.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';

  export let data;

  $: caseStudy = data.caseStudy;
  $: backgroundImage = caseStudy.coverImage ? getStrapiImageAtSize(caseStudy.coverImage) : undefined;

  $: relatedCaseStudies = caseStudy.project
    ? data.caseStudies.filter((s) => s.project?.id === caseStudy.project.id && s.city?.uid !== caseStudy.city.uid).slice(0, 3)
    : [];

  $: publicationLabel = caseStudy.publicationDate
    ? new Date(caseStudy.publicationDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  const components = {
    'image-slider': { component: ImageSlider },
    'avoiding-impacts': { component: AvoidingImpacts, omitBorder: true },
    'future-impacts': { component: FutureImpacts },
    section: { component: SectionContent },
  };

  $: sections = caseStudy.mainContent.map((section) => {
    return { ...components[section.type], title: section.title, props: { ...section, content: section.text } };
  });

</script>

<ContentPageLayout
  {sections}
  {backgroundImage}
  label="Case study"
  title={caseStudy.title || caseStudy.city.label}
  intro={caseStudy.abstract}
>
  <!-- Sidebar extra content -->
  <svelte:fragment slot="sidebar-extra">
    <div class="mt-2 pt-6 mr-12 border-t border-contour-weakest">
      <CopyLink />
    </div>
    <SidebarMetadata
      city={caseStudy.city}
      geography={caseStudy.geography}
      topics={caseStudy.topics}
      scenarios={caseStudy.scenarios}
      project={caseStudy.project}
    />
  </svelte:fragment>

  <!-- Content slot (back link + date + authors + outro) -->
  <svelte:fragment slot="content-header">
    <div class="flex items-center justify-between pb-4 text-sm">
      <a href="/{PATH_ADAPTATION}" class="flex items-center gap-1.5 text-theme-base hover:text-theme-700 transition-colors font-medium">
        <span class="scale-x-[-1] inline-flex"><Arrow /></span>
        Back to Case Studies
      </a>
      {#if publicationLabel}
        <span class="font-bold text-text-weaker">Published on {publicationLabel}</span>
      {/if}
    </div>
  </svelte:fragment>
</ContentPageLayout>

{#if relatedCaseStudies.length}
  <div class="bg-grass-25 border-t border-contour-weakest py-16">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-normal text-theme-stronger">More case studies from {caseStudy.project.Title}</h2>
        <a href="/{PATH_ADAPTATION}" class="flex items-center gap-1.5 text-theme-base font-bold hover:underline whitespace-nowrap">
          View all
          <LinkArrow />
        </a>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each relatedCaseStudies as study}
          <CaseStudyCard {study} />
        {/each}
      </div>
    </div>
  </div>
{/if}
