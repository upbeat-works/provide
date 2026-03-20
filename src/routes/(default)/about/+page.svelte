<script>
  import { LABEL_ABOUT } from '$config';
  import SectionDefault from '$lib/helper/ContentPages/SectionDefault.svelte';
  import ContentPageLayout from '$lib/helper/ContentPages/ContentPageLayout.svelte';
  export let data;

  $: sections = data.content.map((s) => ({ component: SectionDefault, props: s, content: true }));
</script>

<ContentPageLayout {sections} label={LABEL_ABOUT} title="Behind the dashboard" intro="The people and partners behind the platform, the projects contributing data, and the terms for reuse and citation." />
