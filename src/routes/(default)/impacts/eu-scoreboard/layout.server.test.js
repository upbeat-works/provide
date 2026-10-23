import { beforeEach, expect, test, vi } from 'vitest';
import { loadScenarioLabels } from '$lib/server/catalog-content.js';
import { load } from './+layout.server.js';
import { getScoreboard } from '../../../../../api/scoreboard/controller.js';

vi.mock('$lib/server/catalog-content.js', () => ({ loadScenarioLabels: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

test('loads a topic supplied by the API without a web-side registry', async () => {
  const scoreboard = {
    sector: { uid: 'flood-risk', label: 'Flood risk' },
    sectors: [{ uid: 'flood-risk', label: 'Flood risk' }],
    map: { indicators: [], scenarios: [{ id: 'Flood scenario' }], years: [2050] },
    charts: [],
  };
  const fetch = vi.fn(async () => Response.json(scoreboard));
  loadScenarioLabels.mockResolvedValue({});
  const result = await load({ url: new URL('https://example.test/impacts/eu-scoreboard?sector=flood-risk'), fetch });
  expect(result.scoreboard).toEqual(scoreboard);
  const request = new URL(fetch.mock.calls[0][0], 'https://example.test');
  expect(request.pathname).toBe('/api/scoreboard/definition/');
  expect(request.searchParams.get('sector')).toBe('flood-risk');
  expect(loadScenarioLabels).toHaveBeenCalledWith(fetch, { ids: ['Flood scenario'] });
});

test('loads only optional labels for configured scenarios and selects the URL indicator', async () => {
  loadScenarioLabels.mockResolvedValue({ CurrentPolicies: 'Current policies', '1.5C': '1.5°C pathway' });
  const fetch = vi.fn(async () => Response.json(getScoreboard('testing', 'Mean Air Temperature')));

  const result = await load({
    url: new URL('https://example.test/impacts/eu-scoreboard?sector=testing&indicator=Mean%20Air%20Temperature'),
    fetch,
  });

  expect(result.scoreboard.indicator.name).toBe('Mean Air Temperature');
  expect(loadScenarioLabels).toHaveBeenCalledWith(fetch, { ids: ['CurrentPolicies', '1.5C'] });
  expect(result.scenarioLabels).toEqual({ CurrentPolicies: 'Current policies', '1.5C': '1.5°C pathway' });
});

test('uses scenario ID fallbacks returned by optional content loading', async () => {
  loadScenarioLabels.mockResolvedValue({ CurrentPolicies: 'CurrentPolicies', '1.5C': '1.5C' });

  const result = await load({
    url: new URL('https://example.test/impacts/eu-scoreboard?sector=testing'),
    fetch: vi.fn(async () => Response.json(getScoreboard('testing'))),
  });

  expect(result.scenarioLabels).toEqual({ CurrentPolicies: 'CurrentPolicies', '1.5C': '1.5C' });
});
