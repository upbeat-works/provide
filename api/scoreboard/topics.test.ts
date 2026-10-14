import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getScoreboard } from './controller.js';

let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'scoreboard-topics-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function topic(label = 'Flood risk', order = 10) {
  return {
    label, order,
    map: { defaultIndicator: 'Flood days', indicators: [{ name: 'Flood days', variable: 'Flood|Days', type: 'choropleth', level: 'NUTS2' }], scenarios: [{ id: 'Scenario A' }], years: [2050] },
    charts: [{ chartId: 'flood-days', title: 'Flood days', description: 'Annual flood days.', chartType: 'line', data: { variables: ['Flood|Days'] } }],
  };
}

const save = (name: string, value = topic()) => writeFileSync(join(directory, name), JSON.stringify(value));
const load = (uid?: string) => getScoreboard(uid, undefined, { directory });

test('discovers a topic from its filename and serves its map and charts', () => {
  save('flood-risk.json');
  expect(load('flood-risk')).toMatchObject({
    sector: { uid: 'flood-risk', label: 'Flood risk' },
    sectors: [{ uid: 'flood-risk', label: 'Flood risk' }],
    indicator: { name: 'Flood days', variable: 'Flood|Days' },
    charts: [{ chartId: 'flood-days' }],
  });
});

test('sees added, changed and removed files without restarting the loader', () => {
  save('flood-risk.json');
  expect(load().sectors).toHaveLength(1);
  save('water.json', topic('Water', 20));
  expect(load('water').sector).toEqual({ uid: 'water', label: 'Water' });
  const updated = topic('Water supply', 20);
  updated.map.years = [2030, 2050];
  save('water.json', updated);
  expect(load('water')).toMatchObject({ sector: { label: 'Water supply' }, map: { years: [2030, 2050] } });
  rmSync(join(directory, 'water.json'));
  expect(load('water').sector.uid).toBe('flood-risk');
  expect(load().sectors).toHaveLength(1);
});

test('uses order then filename for menu order and the default topic', () => {
  save('zebra.json', topic('First', 1));
  save('water.json', topic('Water', 20));
  save('air.json', topic('Air', 20));
  expect(load('unknown').sector.uid).toBe('zebra');
  expect(load().sectors.map(({ uid }) => uid)).toEqual(['zebra', 'air', 'water']);
});

test('ignores notes and directories and allows a topic with only charts', () => {
  const value = topic();
  writeFileSync(join(directory, 'flood-risk.json'), JSON.stringify({ ...value, map: { ...value.map, indicators: [], defaultIndicator: null } }));
  writeFileSync(join(directory, 'README.md'), 'Topic files');
  mkdirSync(join(directory, 'draft.json'));
  expect(load().sectors).toHaveLength(1);
  expect(load().indicator).toBeUndefined();
});

test('puts topics without an order after ordered topics, sorted by filename', () => {
  const { order, ...value } = topic();
  writeFileSync(join(directory, 'zebra.json'), JSON.stringify(value));
  writeFileSync(join(directory, 'air.json'), JSON.stringify(value));
  save('water.json', topic('Water', 10));
  expect(load().sectors.map(({ uid }) => uid)).toEqual(['water', 'air', 'zebra']);
});

test.each([
  ['label', (value) => { delete value.label; }],
  ['order', (value) => { value.order = 'first'; }],
  ['scenarios', (value) => { value.map.scenarios = []; }],
  ['years', (value) => { value.map.years = ['2050']; }],
  ['defaultIndicator', (value) => { value.map.defaultIndicator = 'Missing'; }],
  ['indicators', (value) => { value.map.indicators.push(value.map.indicators[0]); }],
  ['variable', (value) => { value.map.indicators[0].variable = ''; }],
  ['chartId', (value) => { value.charts.push(value.charts[0]); }],
  ['role', (value) => { value.charts[0].chartType = 'scatter'; }],
])('names the file when its %s config is invalid', (_, change) => {
  const value = topic();
  change(value);
  save('flood-risk.json', value);
  expect(() => load()).toThrow(/flood-risk\.json/);
});

test('reports malformed JSON and an empty topic directory', () => {
  expect(() => load()).toThrow(/No scoreboard topics/);
  writeFileSync(join(directory, 'broken.json'), '{');
  expect(() => load()).toThrow(/broken\.json/);
});
