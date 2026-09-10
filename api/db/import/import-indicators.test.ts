import { describe, test, expect } from 'bun:test';
import { parseIndicatorsYaml, buildIndicatorsSeedSql, titleCaseIndicator } from './import-indicators';

const YAML = `- id: Mean Daily Temperature
  sector: urban-climate
  legacyUid: urbclim-T2M-mean
- id: Glacier Area
  sector: glacier
`;

describe('import-indicators', () => {
  test('uses title case while preserving small words and technical tokens', () => {
    expect(titleCaseIndicator('global atmospheric CH4 concentration from peatland emissions')).toBe('Global Atmospheric CH4 Concentration from Peatland Emissions');
    expect(titleCaseIndicator('heat-wave magnitude index daily (HWMId)')).toBe('Heat-Wave Magnitude Index Daily (HWMId)');
    expect(titleCaseIndicator('days a year with temperatures above X°C')).toBe('Days a Year with Temperatures Above X°C');
  });

  test('parses id, sector and optional legacyUid', () => {
    expect(parseIndicatorsYaml(YAML)).toEqual([
      { id: 'Mean Daily Temperature', sector: 'urban-climate', legacyUid: 'urbclim-T2M-mean' },
      { id: 'Glacier Area', sector: 'glacier', legacyUid: null },
    ]);
  });

  test('emits additive DELETE + INSERT SQL keyed on id', () => {
    const sql = buildIndicatorsSeedSql(parseIndicatorsYaml(YAML));
    expect(sql).toContain('DELETE FROM indicators;');
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Temperature', 'urban-climate', 'urbclim-T2M-mean');",
    );
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Area', 'glacier', NULL);",
    );
  });

  test('rejects duplicate ids and duplicate legacyUids', () => {
    const dupId = `- id: A\n  legacyUid: x\n- id: A\n  legacyUid: y\n`;
    const dupLegacy = `- id: A\n  legacyUid: x\n- id: B\n  legacyUid: x\n`;
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupId))).toThrow(/duplicate id/i);
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupLegacy))).toThrow(/duplicate legacyUid/i);
  });

  test('rejects indicator ids that are not in title case', () => {
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml('- id: Mean daily temperature'))).toThrow(/title case/i);
  });
});
