import { describe, test, expect } from 'bun:test';
import { parseVariable, indicatorsFromVariables, composeVariable, representativeVariable } from './conventions';

describe('representativeVariable', () => {
  test('builds the median variable with default facets', () => {
    expect(representativeVariable('Mean Temperature')).toBe(
      'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
    );
  });
  test('honours overridden facets', () => {
    expect(representativeVariable('Mean Temperature', { period: '1850-1900 (Pre-industrial)', temporal: 'June - August' })).toBe(
      'Mean Temperature|1850-1900 (Pre-industrial)|June - August|Area|50th Percentile',
    );
  });
});

describe('parseVariable', () => {
  test('decomposes a standard percentile variable into its facets', () => {
    expect(parseVariable('Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile')).toEqual({
      raw: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
      indicator: 'Mean Temperature',
      period: '2011-2020 (Present Day)',
      temporal: 'Annual',
      spatial: 'Area',
      value: { kind: 'percentile', raw: '50th Percentile', number: 50 },
    });
  });

  test('classifies a warming-level value', () => {
    const p = parseVariable('Fire Season Length|1850-1900 (Pre-industrial)|June - August|Area|1.5 °C');
    expect(p.indicator).toBe('Fire Season Length');
    expect(p.temporal).toBe('June - August');
    expect(p.value).toEqual({ kind: 'warmingLevel', raw: '1.5 °C', number: 1.5 });
  });

  test('handles the Emissions special case (no spatial/value facets)', () => {
    const p = parseVariable('Emissions|CO2');
    expect(p.indicator).toBe('Emissions');
    expect(p.value).toBeUndefined();
    expect(p.spatial).toBeUndefined();
  });
});

describe('composeVariable', () => {
  test('builds the exact variable name from a selection', () => {
    expect(
      composeVariable({
        indicator: 'Mean Temperature',
        period: '2011-2020 (Present Day)',
        temporal: 'Annual',
        spatial: 'Area',
        value: '50th Percentile',
      }),
    ).toBe('Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile');
  });

  test('round-trips with parseVariable', () => {
    const name = 'Extremely Hot Year with a 10-Year Return Period|1850-1900 (Pre-industrial)|June - August|Area|1.5 °C';
    const p = parseVariable(name);
    expect(
      composeVariable({
        indicator: p.indicator,
        period: p.period!,
        temporal: p.temporal!,
        spatial: p.spatial!,
        value: p.value!.raw,
      }),
    ).toBe(name);
  });
});

describe('indicatorsFromVariables', () => {
  const names = [
    'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile',
    'Mean Temperature|2011-2020 (Present Day)|Annual|Area|5th Percentile',
    'Mean Temperature|2011-2020 (Present Day)|Annual|Area|1.5 °C',
    'Mean Temperature|1850-1900 (Pre-industrial)|June - August|Area|10.0 °C',
    'Fire Season Length|2011-2020 (Present Day)|Annual|Area|95th Percentile',
  ];

  test('collapses variables into one entry per indicator', () => {
    const out = indicatorsFromVariables(names);
    expect(out.map((i) => i.uid).sort()).toEqual(['Fire Season Length', 'Mean Temperature']);
  });

  test('gathers the distinct facet values present for an indicator', () => {
    const mt = indicatorsFromVariables(names).find((i) => i.uid === 'Mean Temperature')!;
    expect(mt.periods).toEqual(['2011-2020 (Present Day)', '1850-1900 (Pre-industrial)']);
    expect(mt.temporals).toEqual(['Annual', 'June - August']);
    expect(mt.spatials).toEqual(['Area']);
  });

  test('sorts the two numeric value axes ascending (not lexically)', () => {
    const mt = indicatorsFromVariables(names).find((i) => i.uid === 'Mean Temperature')!;
    expect(mt.percentiles).toEqual(['5th Percentile', '50th Percentile']);
    expect(mt.warmingLevels).toEqual(['1.5 °C', '10.0 °C']);
  });
});
