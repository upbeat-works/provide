<script>
  import ProjectCard from '../components/ProjectCard.svelte';

  // Editorial content, straight from Strapi (`landing-project`, mapped by
  // $lib/content/landing-project.js). Null when there is nothing published,
  // in which case the block is skipped rather than rendered empty.
  export let content = null;

  $: ({ titleLines = [], intro = null, highlights = null } = content ?? {});
</script>

{#if content}
  <section class="pt-20 pb-12">
    <h2 class="text-3xl tracking-wide text-theme-stronger font-normal mb-8">
      {#each titleLines as line, i}{#if i > 0}<br />{/if}{line}{/each}
    </h2>

    <div class="grid md:grid-cols-2 gap-6">
      {#if intro}
        <ProjectCard {...intro} />
      {/if}
      {#if highlights}
        <ProjectCard {...highlights} />
      {/if}
    </div>
  </section>
{/if}
