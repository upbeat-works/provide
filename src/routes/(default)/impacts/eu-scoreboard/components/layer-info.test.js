import { describe, test, expect } from 'vitest';
import { layerInfo } from './layer-info.js';

const choropleth = {
  name: 'High Heat Risk',
  type: 'choropleth',
  level: 'NUTS2',
  variable: 'High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile',
};
const metadata = {
  variable: 'High Heat Risk|Absolute Values (No Change)|Annual|Area|50th Percentile',
  model: 'RIME-X v1.0.0',
  unit: 'days/yr',
};
// The raster layer exactly as testing.json configures it: prose facets, not
// slugs — slugification happens at the GeoServer boundary, not in the config.
const raster = {
  name: 'Mean Temperature',
  type: 'raster',
  indicator: 'Mean Temperature',
  reference: '1850-1900 (Pre-industrial)',
  time: 'Annual',
  spatial: 'Area',
  unit: '°C',
};

const valueOf = (rows, label) => rows.find((row) => row.label === label)?.value;

describe('layerInfo', () => {
  test('decomposes a choropleth variable into its convention facets', () => {
    const { rows } = layerInfo({ definition: choropleth, metadata });
    expect(rows).toEqual([
      { label: 'Variable', value: 'High Heat Risk' },
      { label: 'Unit', value: 'days/yr' },
      { label: 'Aggregation', value: 'Annual' },
      { label: 'Estimate', value: '50th Percentile' },
      { label: 'Reference period', value: 'Absolute Values (No Change)' },
      { label: 'Spatial basis', value: 'Area' },
      { label: 'Spatial coverage', value: 'NUTS-2 regions' },
      { label: 'Source', value: 'RIME-X v1.0.0' },
    ]);
  });

  test('reads a raster layer off its definition and grid', () => {
    const { rows } = layerInfo({ definition: raster, metadata: { unit: '°C' }, grid: { resolution: 0.11 } });
    expect(valueOf(rows, 'Variable')).toBe('Mean Temperature');
    expect(valueOf(rows, 'Aggregation')).toBe('Annual');
    expect(valueOf(rows, 'Spatial basis')).toBe('Area');
    expect(valueOf(rows, 'Reference period')).toBe('1850-1900 (Pre-industrial)');
    expect(valueOf(rows, 'Spatial coverage')).toBe('0.11° ≈ 12 km');
    // A percentile is a facet of the ixmp4 grammar; a raster has none.
    expect(valueOf(rows, 'Estimate')).toBeUndefined();
  });

  test('omits rows the data cannot answer rather than showing them empty', () => {
    const { rows } = layerInfo({ definition: { ...choropleth, level: undefined }, metadata: { variable: choropleth.variable } });
    expect(rows.map(({ label }) => label)).toEqual(['Variable', 'Aggregation', 'Estimate', 'Reference period', 'Spatial basis']);
  });

  test('falls back to the configured variable when no row was returned', () => {
    const { rows } = layerInfo({ definition: choropleth, metadata: null });
    expect(valueOf(rows, 'Variable')).toBe('High Heat Risk');
    expect(valueOf(rows, 'Unit')).toBeUndefined();
    expect(valueOf(rows, 'Source')).toBeUndefined();
  });

  test('keeps a non-conforming variable name as the indicator alone', () => {
    const { rows } = layerInfo({ definition: choropleth, metadata: { variable: 'Emissions|CO2', unit: 'Mt' } });
    expect(valueOf(rows, 'Variable')).toBe('Emissions');
    expect(valueOf(rows, 'Aggregation')).toBeUndefined();
  });

  test('returns nothing to show for an empty layer', () => {
    expect(layerInfo()).toEqual({ rows: [] });
  });
});
