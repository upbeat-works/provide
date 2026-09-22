import { beforeEach, expect, test, vi } from 'vitest';
import { loadScenarioLabels } from '$lib/server/catalog-content.js';
import { load } from './+layout.server.js';

vi.mock('$lib/server/catalog-content.js', () => ({ loadScenarioLabels: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

test('loads only optional labels for configured scenarios and selects the URL indicator', async () => {
  loadScenarioLabels.mockResolvedValue({ CurrentPolicies: 'Current policies', '1.5C': '1.5°C pathway' });
  const fetch = vi.fn();

  const result = await load({
    url: new URL('https://example.test/projects/eu-scoreboard?sector=testing&indicator=Mean%20Air%20Temperature'),
    fetch,
  });

  expect(result.scoreboard.indicator.name).toBe('Mean Air Temperature');
  expect(loadScenarioLabels).toHaveBeenCalledWith(fetch, { ids: ['CurrentPolicies', '1.5C'] });
  expect(result.scenarioLabels).toEqual({ CurrentPolicies: 'Current policies', '1.5C': '1.5°C pathway' });
});

test('uses scenario ID fallbacks returned by optional content loading', async () => {
  loadScenarioLabels.mockResolvedValue({ CurrentPolicies: 'CurrentPolicies', '1.5C': '1.5C' });

  const result = await load({
    url: new URL('https://example.test/projects/eu-scoreboard?sector=testing'),
    fetch: vi.fn(),
  });

  expect(result.scenarioLabels).toEqual({ CurrentPolicies: 'CurrentPolicies', '1.5C': '1.5C' });
});
