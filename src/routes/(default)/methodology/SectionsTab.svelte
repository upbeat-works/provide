<script>
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import { LABEL_DOCUMENTATION } from '$config';
  import { tabItems } from './tabs.js';

  export let data;

  $: sections = data.sections.map(({ slug, title, description }) => ({
    component: SectionContent,
    props: { slug, title, content: description, as: 'h2' },
  }));
</script>

<ContentPageLayout
  {sections}
  {tabItems}
  label={LABEL_DOCUMENTATION}
  title="How our data is built"
  intro="From models to impact definitions and processing, this section shows how the dashboard is built and how to read it."
/>
