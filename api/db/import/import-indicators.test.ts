import { describe, test, expect } from 'bun:test';
import { parseIndicatorsYaml, buildIndicatorsSeedSql } from './import-indicators';

const YAML = `- id: Mean daily temperature
  sector: urban-climate
  legacyUid: urbclim-T2M-mean
  unit: degrees-celsius
  direction: -1
  colorScale: default
- id: Glacier area
  sector: glacier
`;

describe('import-indicators', () => {
  test('parses curated indicator metadata', () => {
    expect(parseIndicatorsYaml(YAML)).toEqual([
      {
        id: 'Mean daily temperature',
        sector: 'urban-climate',
        legacyUid: 'urbclim-T2M-mean',
        unit: 'degrees-celsius',
        direction: -1,
        colorScale: 'default',
      },
      {
        id: 'Glacier area',
        sector: 'glacier',
        legacyUid: null,
        unit: null,
        direction: null,
        colorScale: null,
      },
    ]);
  });

  test('emits additive DELETE + INSERT SQL keyed on id', () => {
    const sql = buildIndicatorsSeedSql(parseIndicatorsYaml(YAML));
    expect(sql).toContain('DELETE FROM indicators;');
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid, unit, direction, color_scale) VALUES ('Mean daily temperature', 'urban-climate', 'urbclim-T2M-mean', 'degrees-celsius', -1, 'default');",
    );
    expect(sql).toContain(
      "INSERT INTO indicators (id, sector, legacy_uid, unit, direction, color_scale) VALUES ('Glacier area', 'glacier', NULL, NULL, NULL, NULL);",
    );
  });

  test('rejects duplicate ids and duplicate legacyUids', () => {
    const dupId = `- id: A\n  legacyUid: x\n- id: A\n  legacyUid: y\n`;
    const dupLegacy = `- id: A\n  legacyUid: x\n- id: B\n  legacyUid: x\n`;
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupId))).toThrow(/duplicate id/i);
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupLegacy))).toThrow(/duplicate legacyUid/i);
  });
});
