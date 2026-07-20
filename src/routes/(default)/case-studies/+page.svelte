<script>
  import { uniqBy, compact } from 'lodash-es';
  import CaseStudyCard from '../landing-page/components/CaseStudiesCarousel/CaseStudyCard.svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import FilterPill from '$lib/components/ui/FilterPill.svelte';
  import Magnify from '$lib/components/icons/Magnify.svelte';

  export let data;

  let selectedCities = [];
  let selectedScenarios = [];
  let selectedGeographies = [];
  let selectedProjects = [];
  let selectedTopics = [];
  let search = '';

  $: cities = uniqBy(
    data.caseStudies.map((s) => s.city),
    'uid'
  );

  $: scenarioOptions = uniqBy(
    data.caseStudies.flatMap((s) => s.scenarios),
    'id'
  ).map((s) => ({ value: s.id, label: s.label }));
  $: geographyOptions = uniqBy(compact(data.caseStudies.map((s) => s.geography)), 'id').map((g) => ({ value: g.id, label: g.Title }));
  $: projectOptions = uniqBy(compact(data.caseStudies.map((s) => s.project)), 'id').map((p) => ({ value: p.id, label: p.Title }));
  $: topicOptions = uniqBy(
    data.caseStudies.flatMap((s) => s.topics),
    'id'
  ).map((t) => ({ value: t.id, label: t.Title }));

  function toggleCity(uid) {
    selectedCities = selectedCities.includes(uid) ? selectedCities.filter((d) => d !== uid) : [...selectedCities, uid];
  }

  $: filteredCaseStudies = data.caseStudies.filter((study) => {
    const matchesCity = !selectedCities.length || selectedCities.includes(study.city.uid);
    const matchesScenario = !selectedScenarios.length || study.scenarios.some((s) => selectedScenarios.includes(s.id));
    const matchesGeography = !selectedGeographies.length || (study.geography && selectedGeographies.includes(study.geography.id));
    const matchesProject = !selectedProjects.length || (study.project && selectedProjects.includes(study.project.id));
    const matchesTopic = !selectedTopics.length || study.topics.some((t) => selectedTopics.includes(t.id));
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || compact([study.city.label, study.abstract]).some((v) => v.toLowerCase().includes(query));
    return matchesCity && matchesScenario && matchesGeography && matchesProject && matchesTopic && matchesSearch;
  });
</script>

<!-- Hero -->
<div class="bg-grass-25 border-b border-contour-weakest">
  <div class="max-w-6xl mx-auto px-6 py-20 text-center">
    <h1 class="text-5xl font-normal text-theme-stronger mb-5">Case studies</h1>
    <p class="text-lg text-text-weaker max-w-2xl mx-auto">
      Real-world examples of how climate risk dashboard data has been used to support adaptation planning across cities and regions.
    </p>

    {#if cities.length}
      <div class="flex flex-wrap justify-center gap-2 mt-8 max-w-2xl mx-auto">
        {#each cities as city (city.uid)}
          <FilterPill color="grass" selected={selectedCities.includes(city.uid)} on:click={() => toggleCity(city.uid)}>
            {city.label}
          </FilterPill>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Filters -->
<div class="bg-white border-b border-contour-weakest">
  <div class="max-w-7xl mx-auto flex h-fit [&>*]:border-r [&>*]:border-contour-weakest [&>*]:px-6 [&>*]:py-4">
    <MultiSelect label="Scenario" options={scenarioOptions} bind:selected={selectedScenarios} wrapperClass="flex-col" />
    <MultiSelect label="Geography" options={geographyOptions} bind:selected={selectedGeographies} wrapperClass="flex-col" />
    <MultiSelect label="Projects" options={projectOptions} bind:selected={selectedProjects} wrapperClass="flex-col" />
    <MultiSelect label="Topics" options={topicOptions} bind:selected={selectedTopics} wrapperClass="flex-col" />
    <div class="flex-1 flex items-center gap-2">
      <Magnify class="text-theme-base w-4 h-4 flex-shrink-0" />
      <input
        type="search"
        bind:value={search}
        placeholder="Search case studies"
        class="w-full bg-transparent text-sm text-theme-base placeholder:text-theme-base focus:outline-none"
      />
    </div>
  </div>
</div>

<!-- Card grid -->
<div class="max-w-7xl mx-auto px-6 py-12">
  <h2 class="text-2xl font-normal text-theme-stronger mb-6">Last case studies</h2>
  {#if filteredCaseStudies.length}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each filteredCaseStudies as study}
        <CaseStudyCard {study} />
      {/each}
    </div>
  {:else}
    <p class="text-text-weaker text-center py-12">No case studies match the selected filters.</p>
  {/if}
</div>
