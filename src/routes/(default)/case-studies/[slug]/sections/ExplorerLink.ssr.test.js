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

describe('case-study Explorer link', () => {
  test('has no rendered control when there is no safe destination', async () => {
    const explorerLink = await vite.ssrLoadModule('/src/routes/(default)/case-studies/[slug]/sections/ExplorerLink.svelte');

    const rendered = explorerLink.default.render({ href: undefined });

    expect(rendered.html.trim()).toBe('');
  });
});
