import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from 'vite';

let vite;

beforeAll(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { hmr: false, middlewareMode: true },
  });
});

afterAll(async () => {
  await vite.close();
});

describe('scoreboard indicator page SSR', () => {
  test('renders with the owned indicator request store', async () => {
    const state = await vite.ssrLoadModule('/src/stores/state.js');
    state.CURRENT_SCENARIOS_UID.set([]);
    const page = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/indicators/page.ssr.fixture.svelte');
    const data = {
      caseStudies: [],
      geographies: { admin0: [] },
      indicatorIndex: { indicators: [], failedInstances: [] },
      scenarios: [],
    };

    expect(() => page.default.render({ data })).not.toThrow();
  });
});
