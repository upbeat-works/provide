import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import { createRuntimeCatalog } from '$stores/runtime-catalog.js';
import { createCatalogFlow } from '$stores/catalog-flow.js';
import { createOwnedIndicatorIndexRequest } from '$stores/owned-indicator-index.js';
import { parseCatalogUrlSelection } from '$lib/utils/url.js';

const API_ORIGIN = 'https://catalog.example';
const APP_ORIGIN = 'https://provide.example';
const CMS_ORIGIN = 'https://cms.example';
const DATA_ORIGIN = 'https://data.example';

beforeEach(() => {
  vi.stubEnv('SSR', true);
  vi.stubEnv('VITE_API_URL', `${API_ORIGIN}/api`);
  vi.stubEnv('VITE_API_URL_INTERNAL', `${API_ORIGIN}/api`);
  vi.stubEnv('VITE_CMS_URL', CMS_ORIGIN);
  vi.stubEnv('VITE_CMS_URL_INTERNAL', CMS_ORIGIN);
  vi.stubEnv('VITE_STRAPI_LOCALE', 'en');
  vi.stubEnv('VITE_DATA_API_URL', `${DATA_ORIGIN}/api`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function scenarioDetails(description) {
  return [
    {
      id: 'Low Demand',
      label: 'Low Demand',
      instance: 'provide-internal',
      yearStart: 2020,
      yearStep: 10,
      yearEnd: 2100,
      gmt: {
        data: [
          [1.1, 1.2, 1.3],
          [null, null, null],
        ],
        yearStart: 2020,
        yearStep: 10,
        yearEnd: 2030,
        model: 'FaIR',
        unit: '°C',
      },
      characteristics: { gmt2100: 1.5 },
      description,
    },
  ];
}

function createLoaderFetch({
  indicators,
  indicatorFailures = [],
  likelihoods = [],
  mainContent = [],
  scenarioContent = 'present',
  scenarioContentUid = 'Low Demand',
  scenarioTechnicalDescription,
  studyLocations = [],
} = {}) {
  const requests = [];
  const loaderFetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const path = url.pathname.replace(/\/$/, '');

    if (url.origin === API_ORIGIN && path === '/api/indicators') {
      return Response.json({
        indicators: indicators ?? [{ id: 'Heat', label: 'Heat stress', unit: 'days', sector: 'health', instance: 'provide-internal' }],
        failedInstances: indicatorFailures,
      });
    }
    if (url.origin === API_ORIGIN && path === '/api/geographies') {
      return Response.json([{ id: 'lisbon', label: 'Lisbon', geographyType: 'cities', geoId: 'PT001', parents: [] }]);
    }
    if (url.origin === API_ORIGIN && path === '/api/geographies/types') {
      return Response.json([{ id: 'cities', label: 'Cities', labelSingular: 'City', isSelectable: true }]);
    }
    if (url.origin === API_ORIGIN && path === '/api/methodology-scenarios') return Response.json(scenarioDetails(scenarioTechnicalDescription));
    if (url.origin === API_ORIGIN && path === '/api/study-locations') return Response.json({ studyLocations });
    if (url.origin === API_ORIGIN && path === '/api/likelihoods') return Response.json({ likelihoods });
    if (url.origin === API_ORIGIN && path === '/api/catalog') {
      return Response.json({
        indicatorParameters: [],
        facets: [],
        indicators: [{ uid: 'Heat', label: 'Heat stress', unit: 'days', instance: 'provide-internal' }],
        scenarios: [{ uid: 'Low Demand', label: 'Low Demand', startYear: 2020, endYear: 2100 }],
      });
    }
    if (url.origin === CMS_ORIGIN && (path === '/api/glossaries' || path === '/api/scenario-presets')) {
      return Response.json({ data: [] });
    }
    if (url.origin === CMS_ORIGIN && path === '/api/scenarios') {
      if (scenarioContent === 'failure') throw new TypeError('private CMS failure');
      const data = scenarioContent === 'missing' ? [] : [{ id: 8, attributes: { UID: scenarioContentUid, Description: 'Scenario editorial text.' } }];
      return Response.json({ data });
    }
    if (url.origin === CMS_ORIGIN && path === '/api/indicators') {
      return Response.json({ data: [] });
    }
    if (url.origin === CMS_ORIGIN && path === '/api/case-study-outro') return Response.json({ data: null });
    if (url.origin === CMS_ORIGIN && path === '/api/case-study-dynamics') {
      return Response.json({
        data: [
          {
            id: 1,
            attributes: {
              Slug: 'PT001',
              Title: 'Lisbon study',
              Abstract: 'A case study.',
              Authors: 'Research team',
              CoverImage: { data: null },
              Topics: { data: [] },
              Project: { data: null },
              Geography: { data: null },
              Scenarios: { data: [] },
              MainContent: mainContent,
            },
          },
        ],
      });
    }
    if (url.origin === DATA_ORIGIN && path === '/api/avoiding-reference') {
      return Response.json({ impact_levels: { range_of_interest: [2, 2] } });
    }
    if (url.origin === DATA_ORIGIN && path === '/api/avoiding-impacts') {
      return Response.json({ study_locations: { 'city-average': { scenarios: { ld: { year: 'always' } } } } });
    }

    return Response.json({ error: `Unexpected request: ${url.href}` }, { status: 500 });
  };
  return { loaderFetch, requests };
}

function apiPaths(requests) {
  return requests.filter((url) => url.origin === API_ORIGIN).map((url) => url.pathname.replace(/\/$/, ''));
}

describe('focused catalog consumers', () => {
  test('key terms returns its page shell while scenario data is still loading', async () => {
    let finishScenarios;
    const scenarioResponse = new Promise((resolve) => {
      finishScenarios = resolve;
    });
    const { loaderFetch } = createLoaderFetch();
    const slowFetch = (input) => {
      const url = new URL(String(input));
      if (url.pathname.replace(/\/$/, '') === '/api/methodology-scenarios') return scenarioResponse;
      return loaderFetch(input);
    };
    const setHeaders = vi.fn();
    const { load: loadPage } = await import('./(default)/methodology/key-terms/+page.server.js');
    const pageData = await loadPage({ fetch: slowFetch, setHeaders });

    expect(pageData.glossary).toBeInstanceOf(Promise);
    expect(pageData.explainer).toBeInstanceOf(Promise);
    expect(setHeaders).toHaveBeenCalledWith({ 'X-Accel-Buffering': 'no' });

    finishScenarios(Response.json(scenarioDetails()));
    await pageData.explainer;
  });

  test('methodology requests only its scenario resource and rendered Strapi content', async () => {
    const { loaderFetch, requests } = createLoaderFetch();
    const { load: loadPage } = await import('./(default)/methodology/key-terms/+page.server.js');
    const pageData = await loadPage({ fetch: loaderFetch, setHeaders: () => {} });

    expect(apiPaths(requests)).toEqual(['/api/methodology-scenarios']);
    expect(
      requests
        .filter((url) => url.origin === CMS_ORIGIN)
        .map((url) => url.pathname)
        .sort()
    ).toEqual(['/api/glossaries', '/api/scenario-presets', '/api/scenarios']);
    const content = { ...(await pageData.glossary), ...(await pageData.explainer) };
    expect(content.scenarios).toMatchObject([
      {
        uid: 'Low Demand',
        instance: 'provide-internal',
        description: 'Scenario editorial text.',
        startYear: 2020,
        endYear: 2100,
        gmt: [
          { year: 2020, min: 1.1, value: 1.2, max: 1.3 },
          { year: 2030, min: null, value: null, max: null },
        ],
      },
    ]);
  });

  test('methodology joins scenario text when the Strapi UID casing differs', async () => {
    const { loaderFetch } = createLoaderFetch({ scenarioContentUid: 'low demand' });
    const { load: loadPage } = await import('./(default)/methodology/key-terms/+page.server.js');
    const pageData = await loadPage({ fetch: loaderFetch, setHeaders: () => {} });

    expect((await pageData.explainer).scenarios[0].description).toBe('Scenario editorial text.');
  });

  test('methodology keeps technical fallback text when Strapi text is missing', async () => {
    const { loaderFetch } = createLoaderFetch({ scenarioContent: 'missing', scenarioTechnicalDescription: 'Technical fallback.' });
    const { load: loadPage } = await import('./(default)/methodology/key-terms/+page.server.js');
    const pageData = await loadPage({ fetch: loaderFetch, setHeaders: () => {} });
    const scenarios = (await pageData.explainer).scenarios;
    expect(scenarios).toMatchObject([{ uid: 'Low Demand', instance: 'provide-internal', description: 'Technical fallback.' }]);
    expect(scenarios[0]).not.toHaveProperty('attributes');
  });

  test('methodology keeps technical scenarios without text when Strapi fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loaderFetch } = createLoaderFetch({ scenarioContent: 'failure' });
    const { load: loadPage } = await import('./(default)/methodology/key-terms/+page.server.js');
    const pageData = await loadPage({ fetch: loaderFetch, setHeaders: () => {} });
    const scenarios = (await pageData.explainer).scenarios;
    expect(scenarios).toMatchObject([{ uid: 'Low Demand', instance: 'provide-internal' }]);
    expect(scenarios[0].description).toBeUndefined();
    expect(scenarios[0]).not.toHaveProperty('attributes');
    warning.mockRestore();
  });

  test('embed and adaptation do not load a server catalog before a use case needs data', async () => {
    const { loaderFetch, requests } = createLoaderFetch();
    const [{ load: loadEmbed }, { load: loadAdaptation }] = await Promise.all([import('./(embed)/+layout.server.js'), import('./(default)/adaptation/+layout.server.js')]);

    expect(await loadEmbed({ fetch: loaderFetch })).toEqual({});
    expect(await loadAdaptation({ fetch: loaderFetch })).toEqual({});
    expect(apiPaths(requests)).toEqual([]);
  });

  test('scoreboard pages request only the indexes used by each view', async () => {
    const { loaderFetch, requests } = createLoaderFetch();
    const [{ load: loadLayout }, { load: loadRanking }, { load: loadIndicators }] = await Promise.all([
      import('./(default)/projects/eu-scoreboard/+layout.server.js'),
      import('./(default)/projects/eu-scoreboard/+page.server.js'),
      import('./(default)/projects/eu-scoreboard/indicators/+page.server.js'),
    ]);

    expect(await loadLayout({ fetch: loaderFetch })).toEqual({});
    const ranking = await loadRanking({ fetch: loaderFetch });
    expect(apiPaths(requests)).toEqual(['/api/methodology-scenarios']);
    expect(ranking.scenarios[0]).toMatchObject({ uid: 'Low Demand', instance: 'provide-internal' });

    requests.length = 0;
    const indicators = await loadIndicators({ fetch: loaderFetch });
    expect(apiPaths(requests).sort()).toEqual(['/api/geographies', '/api/geographies/types', '/api/indicators', '/api/methodology-scenarios'].sort());
    expect(indicators.indicatorIndex.indicators[0]).toMatchObject({ uid: 'Heat', instance: 'provide-internal' });
    expect(indicators.geographies.cities[0]).toMatchObject({ uid: 'lisbon', label: 'Lisbon' });
    expect(indicators.scenarios[0]).toMatchObject({ uid: 'Low Demand', instance: 'provide-internal' });
  });

  test('scoreboard indicator retry reloads only its owned index', async () => {
    const { loaderFetch, requests } = createLoaderFetch();
    const { loadIndicatorIndex } = await import('$utils/apis.js');
    const request = createOwnedIndicatorIndexRequest({
      initialIndex: { indicators: [], failedInstances: [{ instance: 'failed-source' }] },
      load: () => loadIndicatorIndex(loaderFetch),
    });

    await request.retry();

    expect(apiPaths(requests)).toEqual(['/api/indicators']);
    expect(get(request.state)).toMatchObject({
      status: 'success',
      data: { indicators: [{ uid: 'Heat', instance: 'provide-internal' }] },
    });
  });

  test('case-study list and detail request separate focused data', async () => {
    const { loaderFetch, requests } = createLoaderFetch();
    const [{ load: loadLayout }, { load: loadList }, { load: loadDetail }] = await Promise.all([
      import('./(default)/case-studies/+layout.server.js'),
      import('./(default)/case-studies/+page.server.js'),
      import('./(default)/case-studies/[slug]/+page.server.js'),
    ]);

    expect(await loadLayout({ fetch: loaderFetch })).toEqual({});
    const list = await loadList({ fetch: loaderFetch });
    expect(apiPaths(requests).sort()).toEqual(['/api/geographies', '/api/geographies/types'].sort());
    expect(list.caseStudies[0].city).toEqual({ uid: 'PT001', label: 'Lisbon' });

    requests.length = 0;
    const detail = await loadDetail({ fetch: loaderFetch, parent: async () => ({}), params: { slug: 'PT001' } });
    expect(apiPaths(requests).sort()).toEqual(['/api/geographies', '/api/geographies/types', '/api/indicators'].sort());
    expect(detail.caseStudy.city.label).toBe('Lisbon');
  });

  test('case-study snapshots require an instance when an indicator ID exists in several sources', async () => {
    const futureImpacts = {
      __component: 'future-impacts.future-impacts',
      ExplorerUrl: '/impacts/explore',
      ImpactGeoDescription: 'Map text',
      ImpactTimeDescription: 'Chart text',
      ImpactGeoSnapshot: [{ Indicator: 'Heat', Year: '2050', Image: { data: null } }],
      ImpactTimeSnapshot: [{ Indicator: 'Heat', Image: { data: null } }],
    };
    const { loaderFetch } = createLoaderFetch({
      indicators: [
        { id: 'Heat', label: 'Heat one', unit: 'days', instance: 'first-source' },
        { id: 'Heat', label: 'Heat two', unit: 'days', instance: 'second-source' },
      ],
      mainContent: [futureImpacts],
    });
    const { load: loadDetail } = await import('./(default)/case-studies/[slug]/+page.server.js');

    const detail = await loadDetail({ fetch: loaderFetch, params: { slug: 'PT001' } });

    expect(detail.caseStudy.mainContent).toEqual([]);
  });

  test('case-study snapshots join an indicator by exact ID and instance', async () => {
    const futureImpacts = {
      __component: 'future-impacts.future-impacts',
      ExplorerUrl: '/impacts/explore?indicator=Heat&instance=second-source',
      ImpactGeoDescription: 'Map text',
      ImpactTimeDescription: 'Chart text',
      ImpactGeoSnapshot: [{ Indicator: 'Heat', Instance: 'second-source', Year: '2050', Image: { data: null } }],
      ImpactTimeSnapshot: [{ Indicator: 'Heat', Instance: 'second-source', Image: { data: null } }],
    };
    const { loaderFetch } = createLoaderFetch({
      indicators: [
        { id: 'Heat', label: 'Heat one', unit: 'days', instance: 'first-source' },
        { id: 'Heat', label: 'Heat two', unit: 'days', instance: 'second-source' },
      ],
      mainContent: [futureImpacts],
    });
    const { load: loadDetail } = await import('./(default)/case-studies/[slug]/+page.server.js');

    const detail = await loadDetail({ fetch: loaderFetch, params: { slug: 'PT001' } });

    expect(detail.caseStudy.mainContent[0].impactGeoSnapshots[0].indicator).toMatchObject({
      uid: 'Heat',
      instance: 'second-source',
    });
    expect(detail.caseStudy.mainContent[0].impactTimeSnapshots[0].indicator).toMatchObject({
      uid: 'Heat',
      instance: 'second-source',
    });
  });

  test('case-study avoiding-impact sections keep their focused table data', async () => {
    const avoidingImpacts = {
      __component: 'avoiding-impacts.avoiding-impacts',
      Title: 'Avoided heat',
      Description: 'Avoided impact table.',
      ExplorerUrl: '/impacts/avoid?indicator=Heatwave%20Days%20per%20Year&instance=provide-internal&geography=PT001',
      Indicators: [{ Uid: 'Heatwave Days per Year', Instance: 'provide-internal' }],
      StudyLocations: [{ Uid: 'city-average' }],
    };
    const { loaderFetch, requests } = createLoaderFetch({
      likelihoods: [{ uid: 'likely', label: '33%', value: 0.66 }],
      indicators: [{ id: 'Heatwave Days per Year', label: 'Heatwave days', unit: 'days', instance: 'provide-internal' }],
      mainContent: [avoidingImpacts],
      studyLocations: [{ uid: 'city-average', label: 'City average', order: 1 }],
    });
    const { load: loadDetail } = await import('./(default)/case-studies/[slug]/+page.server.js');

    const detail = await loadDetail({ fetch: loaderFetch, params: { slug: 'PT001' } });

    expect(apiPaths(requests).sort()).toEqual(['/api/geographies', '/api/geographies/types', '/api/indicators', '/api/likelihoods', '/api/methodology-scenarios', '/api/study-locations'].sort());
    expect(
      requests
        .filter((url) => url.origin === DATA_ORIGIN)
        .map((url) => `${url.pathname}${url.search}`)
        .sort()
    ).toEqual(
      [
        '/api/avoiding-impacts?geography=PT001&indicator=urbclim-heatwave-days&level_of_impact=2&certainty_level=likely',
        '/api/avoiding-reference?geography=PT001&indicator=urbclim-heatwave-days',
      ].sort()
    );
    expect(detail.caseStudy.mainContent[0]).toMatchObject({
      type: 'avoiding-impacts',
      explorerUrl: avoidingImpacts.ExplorerUrl,
      data: [
        [
          {
            impactLevel: 2,
            indicator: { uid: 'Heatwave Days per Year', instance: 'provide-internal' },
            likelihood: { uid: 'likely', value: 0.66 },
            scenario: { uid: 'ld', id: 'Low Demand', instance: 'provide-internal' },
            studyLocation: { uid: 'city-average', label: 'City average' },
            year: { uid: 'always', label: 'always' },
          },
        ],
      ],
    });
    expect(detail.caseStudy.mainContent[0].data[0][0]).toEqual({
      impactLevel: 2,
      indicator: {
        id: 'Heatwave Days per Year',
        uid: 'Heatwave Days per Year',
        label: 'Heatwave days',
        unit: 'days',
        instance: 'provide-internal',
      },
      likelihood: { uid: 'likely', value: 0.66 },
      scenario: { uid: 'ld', id: 'Low Demand', label: 'Low Demand', instance: 'provide-internal' },
      studyLocation: { uid: 'city-average', label: 'City average' },
      year: { uid: 'always', label: 'always' },
    });
  });

  test('case-study avoiding-impact data rejects a partial source-free indicator index', async () => {
    const avoidingImpacts = {
      __component: 'avoiding-impacts.avoiding-impacts',
      Indicators: [{ Uid: 'Heat' }],
      StudyLocations: [{ Uid: 'city-average' }],
    };
    const { loaderFetch, requests } = createLoaderFetch({
      indicatorFailures: [{ instance: 'other-source', code: 'unavailable' }],
      mainContent: [avoidingImpacts],
    });
    const { load: loadDetail } = await import('./(default)/case-studies/[slug]/+page.server.js');

    const failure = await loadDetail({ fetch: loaderFetch, params: { slug: 'PT001' } }).catch((reason) => reason);

    expect(failure.status).toBe(503);
    expect(failure.body).toEqual({ message: 'Case study indicator data is temporarily unavailable.' });
    expect(requests.filter((url) => url.origin === DATA_ORIGIN)).toEqual([]);
  });

  test.each([
    ['the matching source failed', [{ id: 'Heat', label: 'Heat one', unit: 'days', instance: 'provide-internal' }], [{ instance: 'provide-internal', code: 'unavailable' }]],
    ['one matching source works while another source failed', [{ id: 'Heat', label: 'Heat one', unit: 'days', instance: 'working-source' }], [{ instance: 'failed-source', code: 'unavailable' }]],
  ])('case-study surfaces incomplete indicator metadata when %s', async (_, indicators, indicatorFailures) => {
    const futureImpacts = {
      __component: 'future-impacts.future-impacts',
      ExplorerUrl: '/impacts/explore',
      ImpactGeoDescription: 'Map text',
      ImpactTimeDescription: 'Chart text',
      ImpactGeoSnapshot: [{ Indicator: 'Heat', Year: '2050', Image: { data: null } }],
      ImpactTimeSnapshot: [{ Indicator: 'Heat', Image: { data: null } }],
    };
    const { loaderFetch } = createLoaderFetch({ indicators, indicatorFailures, mainContent: [futureImpacts] });
    const { load: loadDetail } = await import('./(default)/case-studies/[slug]/+page.server.js');

    const failure = await loadDetail({ fetch: loaderFetch, params: { slug: 'PT001' } }).catch((reason) => reason);

    expect(failure.status).toBe(503);
    expect(failure.body).toEqual({ message: 'Case study indicator data is temporarily unavailable.' });
  });

});
