<script>
  import { PATH_ADAPTATION } from '$src/config.js';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import Outro from '../sections/Outro.svelte';
  import AvoidingImpacts from './sections/AvoidingImpacts.svelte';
  import FutureImpacts from './sections/FutureImpacts.svelte';
  import ImageSlider from './sections/ImageSlider.svelte';
  export let data;

  $: caseStudy = data.caseStudy;

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
  label="Case study"
  dynamicNavigation={true}
  title={caseStudy.title}
  intro={caseStudy.abstract}
>
  {#if caseStudy.authors}
    <section class="html-content mt-16 pt-10 flex items-baseline gap-4 border-t border-contour-weakest">
      <h4>Contributors</h4>
      <p class="text-text-weaker">{caseStudy.authors}</p>
    </section>
  {/if}
  <Outro {...data.caseStudyOutro} />
</ContentPageLayout>
