<script>
  import { LABEL_ABOUT } from '$config';
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  export let data;

  $: sections = data.content.map((s) => ({ component: SectionContent, props: s, content: true }));
</script>

<ContentPageLayout {sections} label={LABEL_ABOUT} title="Behind the dashboard" intro="The people and partners behind the platform, the projects contributing data, and the terms for reuse and citation." />
