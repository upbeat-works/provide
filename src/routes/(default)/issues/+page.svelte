<script>
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  export let data;

  $: sections = data.issues.map((s) => ({ component: SectionContent, props: { ...s, content: s.text }, content: true }));
</script>

<ContentPageLayout {sections} title="Issues" />
