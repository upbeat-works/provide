<script>
  import PageHero from '$lib/components/layouts/PageHero.svelte';
  import ViewTabs from './components/ViewTabs.svelte';
  import { CLASS_SCOREBOARD_BG, LABEL_EU_SCOREBOARD, PATH_EU_SCOREBOARD, PATH_PROJECTS } from '$config';

  // The scoreboard is two views over the same subject, so the hero and the tab
  // switch live here: navigating between them swaps only the body below.
  const base = `/${PATH_PROJECTS}/${PATH_EU_SCOREBOARD}`;
  const views = [
    { href: base, label: 'Scoreboard ranking' },
    { href: `${base}/indicators`, label: 'Explore indicators' },
  ];
</script>

<PageHero
  className={CLASS_SCOREBOARD_BG}
  title={LABEL_EU_SCOREBOARD}
  description="Explore how different scenarios change climate risk across European countries and regions. See where impacts are most likely to exceed key thresholds, and compare outcomes over time to identify hotspots and more resilient pathways."
>
  <img slot="label" src="/img/sparccle-logo-white.svg" alt="SPARCCLE" class="h-8 w-auto" />
  <ViewTabs items={views} />
</PageHero>

<slot />
