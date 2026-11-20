import { expect, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { listEnvelope, server, tabulateEnvelope, testInstance } from '../test-helpers';
import { fetchImpactTime, impactTimeToCsv } from './impact-time';
import { fetchEnsemble } from './unavoidable-risk';

const params = { indicator: 'Heat', geography: 'France', scenarios: ['curpol'] };
const creds = { username: 'u', password: 'p' };

type DatapointQuery = {
  region: { name: string };
  variable: { name: string };
  scenario?: { name__in: string[] };
};

function chartSource(citations = [
  ['Model Information', 'Model citation'],
  ['References', 'Source citation'],
]) {
  const datapoints: DatapointQuery[] = [];
  const metadata: unknown[] = [];
  const variables: unknown[] = [];
  server.use(
    http.patch(`${testInstance.url}/scenarios/`, async ({ request }) => {
      const filter = (await request.json()) as { name__ilike?: string };
      const name = filter.name__ilike?.toLowerCase() === 'today' ? 'Today' : 'CurPol';
      return HttpResponse.json(listEnvelope([{ id: 1, name }]));
    }),
    http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
      variables.push(await request.json().catch(() => ({})));
      return HttpResponse.json(listEnvelope([{ id: 1, name: 'Heat|2011-2020 (Present Day)|Annual|Area|1.5 °C' }]));
    }),
    http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
      const filter = (await request.json()) as DatapointQuery;
      datapoints.push(filter);
      const model = filter.region.name === 'World' ? 'FaIR' : 'Impact model';
      const rows = [[model, 'CurPol', '°C', 0.3, 0.7]];
      if (filter.variable.name.endsWith('1.5 °C')) rows.push([model, 'Today', '°C', 0.1, 0.1]);
      return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'unit', '2020', '2030'], rows));
    }),
    http.patch(`${testInstance.url}/meta/`, async ({ request }) => {
      metadata.push(await request.json().catch(() => ({})));
      return HttpResponse.json(tabulateEnvelope(['key', 'value'], citations));
    })
  );
  return { datapoints, metadata, variables };
}

test('impact chart reads only selected scenarios and its model citations', async () => {
  const queries = chartSource();
  const result = await fetchImpactTime(testInstance, creds, params);

  expect(result.model).toBe('Model citation');
  expect(result.source).toBe('Source citation');
  expect(result.data.curpol).toHaveLength(2);
  expect(result.gmt?.curpol).toHaveLength(2);
  expect(queries.datapoints).toHaveLength(6);
  for (const filter of queries.datapoints) expect(filter.scenario).toEqual({ name__in: ['CurPol'] });
  expect(queries.metadata).toEqual([{ key__in: ['Model Information', 'References'], run: { model: { name: 'Impact model' } } }]);
});

test.each([
  { label: 'regular GMT years', gmtYears: [2030, 2040, 2050, 2060] },
  { label: 'sparse GMT years', gmtYears: [2030, 2050, 2060] },
])('keeps sparse impact dates aligned with $label and CSV dates', async ({ gmtYears }) => {
  const queries = chartSource();
  server.use(
    http.patch(`${testInstance.url}/iamc/datapoints/`, async ({ request }) => {
      const filter = (await request.json()) as DatapointQuery;
      queries.datapoints.push(filter);
      const isGmt = filter.region.name === 'World';
      const years = isGmt ? gmtYears : [2030, 2050, 2060];
      const rows = years.map((year) => [isGmt ? 'FaIR' : 'Impact model', 'CurPol', filter.region.name, filter.variable.name, '°C', 1, year, (year - 2000) / (isGmt ? 10 : 1)]);
      return HttpResponse.json(tabulateEnvelope(['model', 'scenario', 'region', 'variable', 'unit', 'version', 'step_year', 'value'], rows));
    })
  );

  const result = await fetchImpactTime(testInstance, creds, params);
  const chartPoints = result.data.curpol.map((band, index) => ({ year: result.yearStart + result.yearStep * index, band }));
  expect(chartPoints).toEqual([
    { year: 2030, band: [30, 30, 30] },
    { year: 2040, band: [NaN, NaN, NaN] },
    { year: 2050, band: [50, 50, 50] },
    { year: 2060, band: [60, 60, 60] },
  ]);
  expect(result.gmt?.curpol).toEqual(
    [2030, 2040, 2050, 2060].map((year) => {
      const value = gmtYears.includes(year) ? (year - 2000) / 10 : NaN;
      return [value, value, value];
    })
  );
  expect(impactTimeToCsv(result, params).split('\r\n')).toEqual([
    'indicator,region,scenario,year,value,min,max,unit',
    'Heat,France,curpol,2030,30,30,30,°C',
    'Heat,France,curpol,2040,,,,°C',
    'Heat,France,curpol,2050,50,50,50,°C',
    'Heat,France,curpol,2060,60,60,60,°C',
  ]);
  for (const filter of queries.datapoints) expect(filter.scenario).toEqual({ name__in: ['CurPol'] });
});

test('avoid chart scopes thresholds and keeps the Today baseline with selected scenarios', async () => {
  const queries = chartSource();
  const result = await fetchEnsemble(testInstance, creds, params);

  expect(result.data.curpol).toEqual([[0.3, 0.7]]);
  expect(result.today).toEqual([0.1]);
  expect(result.model).toBe('Model citation');
  expect(queries.variables).toEqual([{ name__ilike: 'Heat|*' }]);
  expect(queries.datapoints).toHaveLength(1);
  expect(queries.datapoints[0].scenario).toEqual({ name__in: ['CurPol', 'Today'] });
  expect(queries.metadata).toEqual([{ key__in: ['Model Information', 'References'], run: { model: { name: 'Impact model' } } }]);
});

test.each([
  { chart: 'impact', fetchChart: fetchImpactTime },
  { chart: 'avoid', fetchChart: fetchEnsemble },
])('$chart chart falls back to the datapoint model name when citations are missing', async ({ fetchChart }) => {
  chartSource([]);

  const result = await fetchChart(testInstance, creds, params);

  expect(result.model).toBe('Impact model');
  expect(result.source).toBe('');
});
