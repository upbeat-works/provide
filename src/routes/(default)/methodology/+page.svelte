<script>
  import SectionHeadline from '$lib/components/layouts/ContentPages/SectionHeadline.svelte';
  import Model from './components/Model.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import { LABEL_DOCUMENTATION } from '$config';

  export let data;

  $: sections = [
    ...data.methodology.map(({ title, slug, models, simulation, processing }) => {
      return {
        props: {
          slug,
          title,
        },
        component: SectionHeadline,
        content: true,
        sections: [
          {
            component: Model,
            props: {
              slug: `${slug}-models`,
              title: models.length > 1 ? 'Models' : 'Model',
              content: models,
            },
          },
          {
            component: Model,
            props: {
              slug: `${slug}-simulation`,
              title: simulation.length > 1 ? 'Model simulations' : 'Model simulation',
              content: simulation,
            },
          },
          {
            component: Model,
            props: {
              slug: `${slug}-processing`,
              title: 'Data processing',
              content: processing,
            },
          },
        ],
      };
    }),
  ];
</script>

<ContentPageLayout {sections} label={LABEL_DOCUMENTATION} title="How our data is built" intro="From models to impact definitions and processing, this section shows how the dashboard is built and how to read it." />
