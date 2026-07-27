'use strict';
// The initial content of the landing page's "Learn about the Climate Risk
// Dashboard project" block — verbatim what used to be hardcoded in
// src/routes/(default)/landing-page/sections/SectionProject.svelte, including
// its `#` placeholder links, so seeding changes nothing on screen.
//
// This is a starting point, not a source of truth: once seeded, the block is
// edited in the Strapi admin (Landing: About the project). Pure data — the
// upsert lives in ../seed-landing-project.js.

const INTRO_TEXT = [
  'This platform brings together research from **PROVIDE** a',
  '[Horizon Europe consortium](#) developing faster ways to project climate impacts and',
  'analyse overshoot pathways. **SPARCCLE**, which supplies [EU focused indicators](#),',
  'traffic-light comparisons, and data for the Scoreboard, and **[New project]**, which',
  'will add further models, scenarios, and sectors. Together, these projects contribute',
  'the datasets, methods, and documentation that power the charts and maps you see here.',
].join(' ');

// The heading's line break is content, not markup: editors move it by editing
// the Title field.
const LANDING_PROJECT = {
  Title: 'Learn about the Climate Risk\nDashboard project',
  Intro: {
    Text: INTRO_TEXT,
    LinkLabel: 'Learn more',
    LinkUrl: '#',
  },
  Highlights: {
    Text: 'The Climate Risk Dashboard combines:',
    Items: [
      {
        Title: 'Projections across scales',
        Description:
          'Country- and grid-level projections under multiple scenarios show how indicators change over time and place.',
      },
      {
        Title: 'Ensemble methods & uncertainty',
        Description:
          'Time-series and maps come from model ensembles, summarized with medians and confidence ranges (5th–95th percentiles).',
      },
      {
        Title: '(Un)avoidable risk',
        Description: 'Views that estimate the likelihood of crossing chosen impact levels.',
      },
    ],
    LinkLabel: 'View methodology',
    LinkUrl: '#',
  },
};

module.exports = { LANDING_PROJECT };
