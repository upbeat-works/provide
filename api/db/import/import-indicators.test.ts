import { describe, test, expect } from 'bun:test';
import { parseIndicatorsYaml, buildIndicatorsSeedSql } from './import-indicators';

const YAML = `- id: Mean daily temperature
  sector: urban-climate
  legacyUid: urbclim-T2M-mean
- id: Glacier area
  sector: glacier
`;

describe('import-indicators', () => {
  test('parses id, sector and optional legacyUid', () => {
    expect(parseIndicatorsYaml(YAML)).toEqual([
      { id: 'Mean daily temperature', sector: 'urban-climate', legacyUid: 'urbclim-T2M-mean' },
      { id: 'Glacier area', sector: 'glacier', legacyUid: null },
    ]);
  });

  test('emits additive DELETE + INSERT SQL keyed on id', () => {
    const sql = buildIndicatorsSeedSql(parseIndicatorsYaml(YAML));
    expect(sql).toContain('DELETE FROM indicators;');
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Mean daily temperature', 'urban-climate', 'urbclim-T2M-mean');",
    );
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid) VALUES ('Glacier area', 'glacier', NULL);",
    );
  });

  test('rejects duplicate ids and duplicate legacyUids', () => {
    const dupId = `- id: A\n  legacyUid: x\n- id: A\n  legacyUid: y\n`;
    const dupLegacy = `- id: A\n  legacyUid: x\n- id: B\n  legacyUid: x\n`;
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupId))).toThrow(/duplicate id/i);
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupLegacy))).toThrow(/duplicate legacyUid/i);
  });
});
