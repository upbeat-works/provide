import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createServer } from 'vite';

let vite;
beforeAll(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { hmr: false, middlewareMode: true } });
});
afterAll(async () => vite.close());

const definition = {
  chartId: 'temperature',
  title: 'Temperature',
  description: 'Values over time.',
  chartType: 'line',
  data: { variables: ['Temperature|Mean'] },
};

describe('chart renderer', () => {
  test('renders scatter points without a bubble-size legend', async () => {
    const fixture = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/components/charts/ChartRenderer.test.fixture.svelte');
    const result = {
      status: 'ready',
      definition: { chartId: 'education', chartType: 'scatter', data: { variables: ['Low', 'High'], x: 'Low', y: 'High' } },
      series: [{ x: { variable: 'Low', model: 'Model', unit: 'people' }, y: { variable: 'High', model: 'Model', unit: 'people' } }],
      data: [{ x: 20, y: 30 }],
    };
    const { html } = fixture.default.render({ result });
    expect(html).toContain('<figure>');
    expect(html).toContain('Low (people)');
    expect(html).toContain('High (people)');
    expect(html).not.toMatch(/role="alert"/);
  });
  test('renders ready results through the chart component', async () => {
    const fixture = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/components/charts/ChartRenderer.test.fixture.svelte');
    const result = { definition, status: 'ready', series: [{ line: { variable: 'Temperature|Mean', model: 'Source model', unit: 'K' } }], data: [{ line: [{ year: 2030, value: 2 }] }] };
    const { html } = fixture.default.render({ result });
    expect(html).toContain('<figure>');
    expect(html).toContain('About the data');
    expect(html).not.toMatch(/role="(status|alert)"/);
  });

  test('shows result-level empty and error states', async () => {
    const fixture = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/components/charts/ChartRenderer.test.fixture.svelte');
    const empty = fixture.default.render({ result: { definition, status: 'empty', data: [] } }).html;
    expect(empty).not.toContain('<figure>');
    expect(empty).not.toMatch(/role="alert"/);
    const error = fixture.default.render({ result: { definition, status: 'error', data: [], error: 'Service unavailable' } }).html;
    expect(error).toMatch(/role="alert"/);
    expect(error).toContain('Service unavailable');
  });

  test('breaks a range area around a missing bound', async () => {
    const fixture = await vite.ssrLoadModule('/src/lib/components/charts/layers/MultipleAreaLayer.test.fixture.svelte');
    const { html } = fixture.default.render();
    expect(html).toContain('<path');
    expect(html).not.toContain('NaN');
    expect(html.match(/M/g)).toHaveLength(2);
  });

  test('hides the whole embed for empty data but keeps incomplete URLs visible', async () => {
    const fixture = await vite.ssrLoadModule('/src/routes/(default)/projects/eu-scoreboard/indicators/embed.ssr.fixture.svelte');
    const empty = fixture.default.render({ result: { definition, status: 'empty', data: [] } }).html;
    expect(empty).not.toContain(definition.title);
    expect(empty).not.toContain(definition.description);
    const incomplete = fixture.default.render({ result: undefined }).html;
    expect(incomplete).toMatch(/role="alert"/);
  });
});
