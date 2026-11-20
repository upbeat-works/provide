import { expect, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { fetchModelCitations } from './facets';
import { createPlatform } from './platform';
import { server, tabulateEnvelope, testInstance } from './test-helpers';

async function fetchCitations(rows: unknown[][], model: string | undefined) {
  const queries: unknown[] = [];
  server.use(
    http.patch(`${testInstance.url}/meta/`, async ({ request }) => {
      queries.push(await request.json());
      return HttpResponse.json(tabulateEnvelope(['key', 'value'], rows));
    })
  );

  const platform = await createPlatform(testInstance, 'u', 'p');
  return { citations: await fetchModelCitations(platform, model), queries };
}

test('returns the last usable citation for each key from the requested model', async () => {
  const { citations, queries } = await fetchCitations([
    ['Model Information', 'Earlier model citation'],
    ['References', 'Earlier source citation'],
    ['Model Information', 'Model citation'],
    ['References', 'Source citation'],
    ['Model Information', ' - '],
    ['References', ''],
    ['References', ' '],
    ['References', null],
    ['Temporal Resolution', '5 years'],
  ], 'MESMER');

  expect(citations).toEqual({ model: 'Model citation', source: 'Source citation' });
  expect(queries).toEqual([{ key__in: ['Model Information', 'References'], run: { model: { name: 'MESMER' } } }]);
});

test('returns no citations without a model', async () => {
  const { citations, queries } = await fetchCitations([], undefined);
  expect(citations).toEqual({});
  expect(queries).toEqual([]);
});
