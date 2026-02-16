<script>
  import Entrypoints from './landing-page/Entrypoints.svelte';
  import Globe from './landing-page/Globe.svelte';
  import ExploreControls from './landing-page/ExploreControls.svelte';

  export let data;
  $: ({ stories, caseStudies, videos } = data);
</script>

<Globe {stories} />


<div class="mx-auto max-w-7xl border border-contour-weakest">
  <ExploreControls />
  <Entrypoints {caseStudies} {videos} />
</div>
