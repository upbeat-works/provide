import { describe, expect, test } from 'vitest';
import { regionalMapResult } from './maps';

const variable = 'Maximum Air Temperature|Absolute Values (No Change)|Annual|Area|50th Percentile';
const indicator = { name: 'Maximum Air Temperature', variable, type: 'choropleth', level: 'NUTS2' } as const;

describe('regional map result', () => {
  test('joins by row region, keeps zero and reports response metadata', () => {
    const rows = [
      { variable, scenario: 'CurrentPolicies', region: 'AT11', model: 'RIME-X', unit: '°C', '2050': 0 },
      { variable, scenario: 'CurrentPolicies', region: 'AT12', model: 'RIME-X', unit: '°C', '2050': null },
    ];

    expect(regionalMapResult(rows, indicator, 'CurrentPolicies', 2050)).toEqual({
      definition: indicator,
      status: 'ready',
      values: [{ region: 'AT11', value: 0 }],
      metadata: { variable, model: 'RIME-X', unit: '°C' },
    });
  });

  test('rejects two finite values for one region', () => {
    const rows = [
      { variable, scenario: 'CurrentPolicies', region: 'AT11', model: 'RIME-X', unit: '°C', '2050': 1 },
      { variable, scenario: 'CurrentPolicies', region: 'AT11', model: 'RIME-X', unit: '°C', '2050': 2 },
    ];

    expect(() => regionalMapResult(rows, indicator, 'CurrentPolicies', 2050)).toThrow('Ambiguous regional map rows');
  });
});
