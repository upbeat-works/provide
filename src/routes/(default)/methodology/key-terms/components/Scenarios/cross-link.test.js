import { describe, expect, test } from 'vitest';
import { parseCatalogUrlSelection } from '$lib/utils/url.js';
import { buildURL } from '$utils/url.js';
import { methodologyExplorerParams } from './cross-link.js';

describe('methodology explorer link', () => {
  test('carries selected scenarios without leaking a previous Explore context', () => {
    const query = buildURL('impact', methodologyExplorerParams(['new'], 'source-a'));

    expect(parseCatalogUrlSelection(new URL(`https://provide.example/impacts/explore${query}`))).toEqual({
      parameters: {},
      scenarios: ['new'],
      instance: 'source-a',
    });
  });

  test('does not invent an indicator owner for a fresh selection', () => {
    const params = methodologyExplorerParams(['new']);

    expect(params).toEqual({ scenarios: ['new'] });
    expect(params).not.toHaveProperty('indicator');
    expect(params).not.toHaveProperty('instance');
  });
});
