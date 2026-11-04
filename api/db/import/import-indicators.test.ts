import { describe, test, expect } from 'bun:test';
import { parseIndicatorsYaml, buildIndicatorsSeedSql } from './import-indicators';

const YAML = `- id: Mean Daily Temperature
  sector: urban-climate
  legacyUid: urbclim-T2M-mean
- id: Glacier Area
  sector: glacier
`;

describe('import-indicators', () => {
  test('parses id, sector and optional legacyUid', () => {
    expect(parseIndicatorsYaml(YAML)).toEqual([
      { id: 'Mean Daily Temperature', sector: 'urban-climate', legacyUid: 'urbclim-T2M-mean' },
      { id: 'Glacier Area', sector: 'glacier', legacyUid: null },
    ]);
  });

  test('replaces indicator enrichment with rows keyed on id', () => {
    const sql = buildIndicatorsSeedSql(parseIndicatorsYaml(YAML));
    expect(sql).toContain('DELETE FROM indicators;');
    expect(sql).toContain("INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean Daily Temperature', 'urban-climate', 'urbclim-T2M-mean');");
    expect(sql).toContain("INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier Area', 'glacier', NULL);");
  });

  test('rejects duplicate ids and duplicate legacyUids', () => {
    const dupId = `- id: A\n  legacyUid: x\n- id: A\n  legacyUid: y\n`;
    const dupLegacy = `- id: A\n  legacyUid: x\n- id: B\n  legacyUid: x\n`;
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupId))).toThrow(/duplicate id/i);
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupLegacy))).toThrow(/duplicate legacyUid/i);
  });

  test('accepts exact source names even when they are not in title case', () => {
    const rows = parseIndicatorsYaml('- id: Days with Maximum Temperatures above 30 °C\n  sector: urban-climate\n');
    expect(() => buildIndicatorsSeedSql(rows)).not.toThrow();
  });
});
