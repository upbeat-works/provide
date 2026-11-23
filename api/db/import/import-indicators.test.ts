import { describe, test, expect } from 'bun:test';
import { sql } from 'drizzle-orm';
import { schema } from '..';
import { createTestEnv } from '../../test-helpers';
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

  test('repeated seeding keeps other sector links and existing legacy metadata', async () => {
    const env = await createTestEnv();
    await env.DB.execute(sql.raw(buildIndicatorsSeedSql(parseIndicatorsYaml(YAML))));
    const update = buildIndicatorsSeedSql(parseIndicatorsYaml(`- id: Mean Daily Temperature
  sector: urban-climate
- id: Days with Maximum Temperatures above 30 °C
  sector: urban-climate
`));
    await env.DB.execute(sql.raw(update));
    await env.DB.execute(sql.raw(update));
    expect(await env.DB.select().from(schema.indicators).orderBy(schema.indicators.id)).toEqual([
      { id: 'Days with Maximum Temperatures above 30 °C', sector: 'urban-climate', legacyUid: null },
      { id: 'Glacier Area', sector: 'glacier', legacyUid: null },
      { id: 'Mean Daily Temperature', sector: 'urban-climate', legacyUid: 'urbclim-T2M-mean' },
    ]);
  });

  test('rejects duplicate ids and duplicate legacyUids', () => {
    const dupId = `- id: A\n  legacyUid: x\n- id: A\n  legacyUid: y\n`;
    const dupLegacy = `- id: A\n  legacyUid: x\n- id: B\n  legacyUid: x\n`;
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupId))).toThrow(/duplicate id/i);
    expect(() => buildIndicatorsSeedSql(parseIndicatorsYaml(dupLegacy))).toThrow(/duplicate legacyUid/i);
  });
});
