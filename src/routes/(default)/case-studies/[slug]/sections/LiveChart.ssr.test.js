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

describe('case-study live chart', () => {
  test('renders the embed in a titled, lazy iframe with its caption', async () => {
    const liveChart = await vite.ssrLoadModule('/src/routes/(default)/case-studies/[slug]/sections/LiveChart.svelte');

    const { html } = liveChart.default.render({
      title: 'Heat over time',
      description: '<p>Days above 35°C.</p>',
      embedUrl: '/embed/impact-time?indicator=Heat&inline=true',
      explorerUrl: '/impacts/explore',
    });

    expect(html).toContain('src="/embed/impact-time?indicator=Heat&amp;inline=true"');
    expect(html).toContain('title="Heat over time"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('Days above 35°C.');
    expect(html).toContain('href="/impacts/explore"');
  });

  test('names an untitled chart for screen readers and omits an empty caption', async () => {
    const liveChart = await vite.ssrLoadModule('/src/routes/(default)/case-studies/[slug]/sections/LiveChart.svelte');

    const { html } = liveChart.default.render({ embedUrl: '/embed/impact-geo?inline=true' });

    expect(html).toContain('title="Interactive chart"');
    expect(html).not.toContain('<figcaption');
  });
});
