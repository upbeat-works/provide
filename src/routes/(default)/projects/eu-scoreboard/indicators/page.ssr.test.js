import { afterAll, beforeAll, expect, test } from 'vitest';
import { createServer } from 'vite';

let vite;
beforeAll(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { hmr: false, middlewareMode: true } });
});
afterAll(async () => vite.close());

test('shows only charts with visible results', async () => {
  const page = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/indicators/page.ssr.fixture.svelte');
  const { getScoreboard } = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/controller.js');
  const scoreboard = getScoreboard('testing');
  const definition = scoreboard.definitions[0];
  const data = {
    scoreboard,
    scenarios: [],
    regions: [],
    years: [],
    selection: {},
    charts: [{ definition, result: { definition, status: 'ready', data: [{ line: [{ year: 2050, value: null }] }] } }],
  };
  const empty = page.default.render({ data });
  expect(empty.html).not.toContain(definition.title);

  data.charts[0].result = { definition, status: 'ready', data: [{ line: [{ year: 2050, value: 2 }] }] };
  const ready = page.default.render({ data });
  expect(ready.html).toContain(definition.title);

  data.charts[0].result = { definition, status: 'error', data: [], error: 'Source unavailable' };
  const error = page.default.render({ data });
  expect(error.html).toContain(definition.title);
  expect(error.html).toContain('Source unavailable');
});
