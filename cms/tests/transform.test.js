import { test, expect } from 'bun:test';

const { toCreateData, collectMedia } = require('../scripts/lib/transform.js');

// Shapes below mirror real production REST payloads captured in .snapshot/.
const media = (id, url) => ({ data: { id, attributes: { url, name: `f${id}`, mime: 'image/png', hash: `h${id}`, ext: '.png', size: 1 } } });

test('drops createdAt/updatedAt/localizations but keeps publishedAt, locale, content', () => {
  const out = toCreateData(
    { UID: 'x', Description: 'hi', locale: 'en-EU', publishedAt: '2024-01-01T00:00:00.000Z', createdAt: 'c', updatedAt: 'u', localizations: { data: [] } },
    new Map(),
  );
  expect(out).toEqual({ UID: 'x', Description: 'hi', locale: 'en-EU', publishedAt: '2024-01-01T00:00:00.000Z' });
});

test('strips the id from repeatable component items but keeps their fields', () => {
  const out = toCreateData(
    { ScenarioCharacteristics: [{ id: 17, Year: '2050', Description: 'd' }, { id: 16, Year: '2100', Description: 'e' }] },
    new Map(),
  );
  expect(out.ScenarioCharacteristics).toEqual([{ Year: '2050', Description: 'd' }, { Year: '2100', Description: 'e' }]);
});

test('keeps __component and strips id inside dynamic-zone items', () => {
  const out = toCreateData(
    { MainContent: [{ id: 3, __component: 'future-impacts.impact-geo', Title: 'T' }] },
    new Map(),
  );
  expect(out.MainContent).toEqual([{ __component: 'future-impacts.impact-geo', Title: 'T' }]);
});

test('rewrites a single media field to the mapped local file id; empty media -> null', () => {
  const map = new Map([[42, 900]]);
  const out = toCreateData({ Image: media(42, 'http://c/x.png'), Missing: { data: null } }, map);
  expect(out.Image).toBe(900);
  expect(out.Missing).toBeNull();
});

test('omits content relations (handled in a later pass)', () => {
  const out = toCreateData(
    { UID: 'a', ScenarioPresets: { data: [{ id: 16, attributes: { Title: 'P' } }] } },
    new Map(),
  );
  expect(out).toEqual({ UID: 'a' });
});

test('rewrites media nested inside dynamic-zone components', () => {
  const map = new Map([[42, 900]]);
  const out = toCreateData(
    { MainContent: [{ id: 3, __component: 'future-impacts.impact-time-snapshot', Image: media(42, 'http://c/x.png') }] },
    map,
  );
  expect(out.MainContent).toEqual([{ __component: 'future-impacts.impact-time-snapshot', Image: 900 }]);
});

test('collectMedia finds every nested media node with its file attributes', () => {
  const found = collectMedia({
    Cover: media(42, 'http://c/a.png'),
    MainContent: [{ id: 3, __component: 'x.y', Image: media(43, 'http://c/b.png') }],
  });
  expect(found.map((m) => m.id).sort()).toEqual([42, 43]);
  expect(found.find((m) => m.id === 42).attributes.url).toBe('http://c/a.png');
});
