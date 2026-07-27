import { describe, test, expect } from 'bun:test';
import { stripUnitSuffix, indicatorDescriptions } from './descriptions';

const PROSE =
  "Temperature of the air near the Earth's surface, averaged over the time scale of interest. Changes in this indicator are expressed in degrees Celsius (°C).";

describe('stripUnitSuffix', () => {
  test('removes the trailing unit marker', () => {
    expect(stripUnitSuffix(`${PROSE} [°C]`)).toBe(PROSE);
  });

  test('removes a percent marker too', () => {
    expect(stripUnitSuffix(`${PROSE} [%]`)).toBe(PROSE);
  });

  test('leaves a description without a marker untouched', () => {
    expect(stripUnitSuffix(PROSE)).toBe(PROSE);
  });

  test('only strips at the end, not brackets inside the prose', () => {
    const inner = 'Days above a threshold [as defined by WMO] per year.';
    expect(stripUnitSuffix(inner)).toBe(inner);
  });

  test('strips the last marker only, keeping earlier bracketed text', () => {
    expect(stripUnitSuffix('Index [WMO] value. [%]')).toBe('Index [WMO] value.');
  });
});

describe('indicatorDescriptions', () => {
  test('keys the description by indicator, not by variable', () => {
    const map = indicatorDescriptions([
      { variable: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile', description: `${PROSE} [°C]` },
    ]);
    expect(map.get('Mean Temperature')).toBe(PROSE);
  });

  test('collapses the many variables of one indicator into a single entry', () => {
    const map = indicatorDescriptions([
      { variable: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|50th Percentile', description: `${PROSE} [°C]` },
      { variable: 'Mean Temperature|2011-2020 (Present Day)|Annual|Area|5th Percentile', description: `${PROSE} [%]` },
    ]);
    expect(map.size).toBe(1);
    expect(map.get('Mean Temperature')).toBe(PROSE);
  });

  test('ignores blank docs so they do not win over real prose', () => {
    const map = indicatorDescriptions([
      { variable: 'Mean Temperature|a|b|c|50th Percentile', description: '   ' },
      { variable: 'Mean Temperature|a|b|c|5th Percentile', description: PROSE },
    ]);
    expect(map.get('Mean Temperature')).toBe(PROSE);
  });

  test('an indicator with no usable docs is absent, not empty-string', () => {
    const map = indicatorDescriptions([{ variable: 'Glacier area|a|b|c|50th Percentile', description: '' }]);
    expect(map.has('Glacier area')).toBe(false);
  });

  test('keeps indicators apart', () => {
    const map = indicatorDescriptions([
      { variable: 'Mean Temperature|a|b|c|50th Percentile', description: 'Temp prose.' },
      { variable: 'Glacier area|a|b|c|50th Percentile', description: 'Glacier prose.' },
    ]);
    expect(map.get('Mean Temperature')).toBe('Temp prose.');
    expect(map.get('Glacier area')).toBe('Glacier prose.');
  });
});
