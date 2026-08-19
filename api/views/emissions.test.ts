import { describe, test, expect } from 'bun:test';
import { assembleEmissions, emissionsCharacteristics } from './emissions';
import type { WideRow } from '../tabulate';

const row = (scenario: string, values: Record<string, number | null>): WideRow => ({
  scenario,
  ...values,
});

describe('assembleEmissions', () => {
  // ixmp4 publishes Emissions|Kyoto Gases in Mt CO2-equiv/yr; the methodology
  // chart/table labels are hardcoded to GtCO2eq/yr, so raw values are /1000.
  test('converts Mt CO2-equiv/yr to GtCO2eq/yr', () => {
    const out = assembleEmissions([2020], [row('curpol', { '2020': 40000 })]);
    expect(out.get('curpol')!.data).toEqual([40]);
  });

  test('reads one value per year, unbanded', () => {
    const out = assembleEmissions([2020, 2025], [row('curpol', { '2020': 40000, '2025': 38000 })]);
    expect(out.get('curpol')!.data).toEqual([40, 38]);
  });

  test('trims a scenario to the years it actually has, without shifting', () => {
    const years = [2020, 2025, 2030, 2035];
    const out = assembleEmissions(years, [row('curpol', { '2020': 40000, '2025': 38000, '2030': null, '2035': null })]);
    const curpol = out.get('curpol')!;
    expect(curpol.data).toEqual([40, 38]);
    expect(curpol.yearStart).toBe(2020);
    expect(curpol.yearEnd).toBe(2025);
    expect(curpol.yearStep).toBe(5);
  });

  test('drops a scenario with no real values', () => {
    const out = assembleEmissions([2020], [row('curpol', { '2020': null })]);
    expect(out.size).toBe(0);
  });

  test('keeps the raw ixmp4 scenario name for display', () => {
    const out = assembleEmissions([2020], [row('SSP1-1.9', { '2020': 40000 })]);
    expect(out.get('ssp1-1.9')!.scenario).toBe('SSP1-1.9');
  });

  test('carries model off the row and reports the converted GtCO2eq/yr unit', () => {
    const out = assembleEmissions([2020], [{ scenario: 'curpol', model: 'FaIR v1.6.4', unit: 'Mt CO2-equiv/yr', '2020': 40000 }]);
    const curpol = out.get('curpol')!;
    expect(curpol.model).toBe('FaIR v1.6.4');
    expect(curpol.unit).toBe('GtCO2eq/yr');
  });

  test('derives emissions2050/emissions2100 characteristics from the trimmed, converted series', () => {
    const out = assembleEmissions([2050, 2100], [row('curpol', { '2050': 25360, '2100': 2100 })]);
    expect(out.get('curpol')!.characteristics).toEqual({ emissions2050: 25.4, emissions2100: 2.1 });
  });
});

describe('emissionsCharacteristics', () => {
  const pts = (o: Record<number, number>) => Object.entries(o).map(([year, value]) => ({ year: Number(year), value }));

  test('reads off 2050 and 2100', () => {
    expect(emissionsCharacteristics(pts({ 2020: 40, 2050: 25.36, 2100: 2.1 }))).toEqual({
      emissions2050: 25.4,
      emissions2100: 2.1,
    });
  });

  test('omits a key the series does not reach', () => {
    expect(emissionsCharacteristics(pts({ 2020: 40, 2050: 25.4 }))).toEqual({ emissions2050: 25.4 });
  });

  test('omits both keys for an empty series', () => {
    expect(emissionsCharacteristics([])).toEqual({});
  });
});
