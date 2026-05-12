<script>
  import SectionContent from '$src/lib/components/layouts/SectionContent.svelte';
  import ContentPageLayout from '$lib/components/layouts/ContentPageLayout.svelte';
  import { LABEL_DOCUMENTATION, LABEL_KEY_CONCEPTS, PATH_DOCUMENTATION, PATH_KEY_CONCEPTS } from '$config';

  const tabItems = [
    { href: `/${PATH_DOCUMENTATION}`, label: 'Impact' },
    { href: `/${PATH_DOCUMENTATION}/${PATH_KEY_CONCEPTS}`, label: LABEL_KEY_CONCEPTS },
  ];

  export let data;

  $: sections = [
    ...data.methodology.map(({ title, slug, models, simulation, processing }) => {
      return {
        props: {
          slug,
          title,
        },
        component: SectionContent,
        content: true,
        sections: [
          {
            props: {
              slug: `${slug}-models`,
              title: models.length > 1 ? 'Models' : 'Model',
              as: 'h3'
            },
            component: SectionContent,
            sections: [...models.map(({ slug: modelSlug, title: modelTitle, description }) => ({
              component: SectionContent,
              props: {
                slug: modelSlug,
                title: modelTitle,
                content: description,
                as: 'h4',
              },
            }))],
          },
          {
            component: SectionContent,
            props: {
              slug: `${slug}-simulation`,
              title: simulation.length > 1 ? 'Model simulations' : 'Model simulation',
              as: 'h3',
            },
            sections: [...simulation.map(({ slug: simulationSlug, title: simulationTitle, description }) => ({
              component: SectionContent,
              props: {
                slug: simulationSlug,
                title: simulationTitle,
                content: description,
                as: 'h4',
              },
            }))],
          },
          {
            component: SectionContent,
            props: {
              slug: `${slug}-processing`,
              title: 'Data processing',
              as: 'h3',
            },
            sections: [...processing.map(({ slug: processingSlug, title: processingTitle, description }) => ({
              component: SectionContent,
              props: {
                slug: processingSlug,
                title: processingTitle,
                content: description,
                as: 'h4',
              },
            }))],
          },
        ],
      };
    }),
  ];
</script>

<ContentPageLayout {sections} {tabItems} label={LABEL_DOCUMENTATION} title="How our data is built" intro="From models to impact definitions and processing, this section shows how the dashboard is built and how to read it." />
