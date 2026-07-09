<script>
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import Outro from '../sections/Outro.svelte';
  import AvoidingImpacts from './sections/AvoidingImpacts.svelte';
  import FutureImpacts from './sections/FutureImpacts.svelte';
  import ImageSlider from './sections/ImageSlider.svelte';
  import { PATH_ADAPTATION } from '$src/config.js';
  import { getStrapiImageAtSize } from '$lib/utils/utils';
  import Arrow from '$lib/components/icons/Arrow.svelte';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';

  export let data;

  $: caseStudy = data.caseStudy;
  $: backgroundImage = caseStudy.coverImage ? getStrapiImageAtSize(caseStudy.coverImage) : undefined;

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
    <div class="pt-6">
      <CopyLink />
    </div>
  </svelte:fragment>

  <!-- Content slot (back link + date + authors + outro) -->
  <svelte:fragment slot="content-header">
    <div class="flex items-center justify-between pb-4 text-sm">
      <a href="/{PATH_ADAPTATION}" class="flex items-center gap-1.5 text-theme-base hover:text-theme-700 transition-colors font-medium">
        <span class="scale-x-[-1] inline-flex"><Arrow /></span>
        Back to Case Studies
      </a>
      {#if publicationLabel}
        <span class="text-text-weaker">Published on {publicationLabel}</span>
      {/if}
    </div>
  </svelte:fragment>

  {#if caseStudy.authors}
    <section class="html-content mt-16 pt-10 flex items-baseline gap-4 border-t border-contour-weakest">
      <h4>Contributors</h4>
      <p class="text-text-weaker">{caseStudy.authors}</p>
    </section>
  {/if}
  <Outro {...data.caseStudyOutro} />
</ContentPageLayout>
