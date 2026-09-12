import { describe, expect, test } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { geographyIdsForIndicator, groupIndicatorVariableNames, indicatorIdsFromVariableNames } from './availability';
import { createPlatform } from '../platform';
import { listEnvelope, server, testInstance } from '../test-helpers';

const indicator = 'Mean Temperature';
const nonDefaultVariable = 'Mean Temperature|2011-2020 (Present Day)|Seasonal|Point|95th Percentile';

describe('catalog availability', () => {
  test('gets distinct indicator IDs only from faceted variable names', () => {
    expect(
      indicatorIdsFromVariableNames([
        nonDefaultVariable,
        'Fire Season Length|2011-2020 (Present Day)|Annual|Area|50th Percentile',
        'Mean Temperature|1850-1900 (Pre-industrial)|Annual|Area|1.5 °C',
        'Global Mean Temperature|50th Percentile',
        'Emissions|CO2',
      ])
    ).toEqual(['Mean Temperature', 'Fire Season Length']);
  });

  test('groups valid indicators and drops a malformed empty indicator', () => {
    expect(
      groupIndicatorVariableNames([
        '|2011-2020 (Present Day)|Annual|Area|50th Percentile',
        nonDefaultVariable,
        'Mean Temperature|1850-1900 (Pre-industrial)|Annual|Area|1.5 °C',
        'Global Mean Temperature|50th Percentile',
      ])
    ).toEqual([
      {
        id: 'Mean Temperature',
        names: [nonDefaultVariable, 'Mean Temperature|1850-1900 (Pre-industrial)|Annual|Area|1.5 °C'],
        percentileNames: [nonDefaultVariable],
      },
    ]);
  });

  test('finds geographies with data only under a non-default variable', async () => {
    let variableFilter: unknown;
    let regionFilter: unknown;
    server.use(
      http.patch(`${testInstance.url}/iamc/variables/`, async ({ request }) => {
        variableFilter = await request.json();
        return HttpResponse.json(
          listEnvelope([
            { id: 1, name: nonDefaultVariable },
            {
              id: 2,
              name: 'Mean Temperature Anomaly|2011-2020 (Present Day)|Annual|Area|50th Percentile',
            },
          ])
        );
      }),
      http.patch(`${testInstance.url}/regions/`, async ({ request }) => {
        regionFilter = await request.json();
        return HttpResponse.json(
          listEnvelope([
            { id: 1, name: 'DEU' },
            { id: 2, name: 'FRA' },
            { id: 3, name: 'DEU' },
          ])
        );
      })
    );

    const platform = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(await geographyIdsForIndicator(platform, indicator)).toEqual(['DEU', 'FRA']);
    expect(variableFilter).toEqual({ name__ilike: 'Mean Temperature|*' });
    expect(regionFilter).toEqual({
      iamc: { variable: { name__in: [nonDefaultVariable] } },
    });
  });
});
