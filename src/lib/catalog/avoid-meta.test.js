import { describe, test, expect } from 'bun:test';
import { buildAvoidMeta } from './avoid-meta.js';

const META = {
  geographyTypes: [
    { uid: 'cities', label: 'Cities', availableIndicators: ['urbclim-T2M-mean', 'ghost-no-meta'] },
  ],
  cities: [
    { uid: 'accra', label: 'Accra' },
    { uid: 'amman', label: 'Amman' },
  ],
  indicators: [
    { uid: 'urbclim-T2M-mean', label: 'Mean daily temperature', sector: 'urban-climate', availableGeographies: ['accra'], parameters: {} },
    { uid: 'terclim-mean-temperature', label: 'Mean temperature', sector: 'terrestrial-climate', availableGeographies: ['DEU'], parameters: {} },
  ],
  indicatorParameters: [{ uid: 'time', label: 'Time', options: [] }],
  likelihoods: [{ uid: 'likely', label: 'Likely' }],
  studyLocations: [{ uid: 'city-average', label: 'City average' }],
  scenarios: [{ uid: 'sdp', label: 'SDP' }],
};
const DESCRIPTIONS = {
  indicators: [{ attributes: { UID: 'urbclim-T2M-mean', Description: 'desc' } }],
  scenarios: [],
};

describe('buildAvoidMeta', () => {
  test('keeps only city-available indicators with metadata, in legacy id space', () => {
    const out = buildAvoidMeta(META, DESCRIPTIONS);
    // 'ghost-no-meta' is inert (no indicator metadata); 'terclim-*' is not
    // city-available. Only 'urbclim-T2M-mean' survives.
    expect(out.indicators.map((i) => i.uid)).toEqual(['urbclim-T2M-mean']);
    expect(out.indicators[0].description).toBe('desc');
    expect(out.indicators[0].availableGeographies).toEqual(['accra']);
  });

  test('passes through cities, params, likelihoods, studyLocations', () => {
    const out = buildAvoidMeta(META, DESCRIPTIONS);
    expect(out.cities.map((c) => c.uid)).toEqual(['accra', 'amman']);
    expect(out.indicatorParameters.map((p) => p.uid)).toEqual(['time']);
    expect(out.likelihoods.map((l) => l.uid)).toEqual(['likely']);
    expect(out.studyLocations.map((s) => s.uid)).toEqual(['city-average']);
  });

  test('is safe on an empty/missing meta', () => {
    expect(buildAvoidMeta()).toEqual({
      cities: [], indicators: [], indicatorParameters: [], sectors: [], likelihoods: [], studyLocations: [], scenarios: [],
    });
  });

  test('passes through sectors for the indicator picker pills', () => {
    const out = buildAvoidMeta({ ...META, sectors: [{ uid: 'urban-climate', label: 'Urban heat stress' }] }, DESCRIPTIONS);
    expect(out.sectors).toEqual([{ uid: 'urban-climate', label: 'Urban heat stress' }]);
  });

  test('resolves indicator.unit (a uid string) to the unit object, with a fallback', () => {
    const meta = {
      ...META,
      geographyTypes: [{ uid: 'cities', availableIndicators: ['a', 'b'] }],
      indicators: [
        { uid: 'a', label: 'A', sector: 'urban-climate', unit: 'degrees-celsius', availableGeographies: [], parameters: {} },
        { uid: 'b', label: 'B', sector: 'urban-climate', unit: 'unknown-unit', availableGeographies: [], parameters: {} },
      ],
      units: [{ uid: 'degrees-celsius', label: '°C', labelLong: 'degrees Celsius' }],
    };
    const out = buildAvoidMeta(meta, DESCRIPTIONS);
    expect(out.indicators.find((i) => i.uid === 'a').unit).toEqual({ uid: 'degrees-celsius', label: '°C', labelLong: 'degrees Celsius' });
    // Missing from units → fall back to a self-describing object.
    expect(out.indicators.find((i) => i.uid === 'b').unit).toEqual({ uid: 'unknown-unit', label: 'unknown-unit', labelLong: 'unknown-unit' });
  });

  test('merges sector-level availableGeographies onto each indicator', () => {
    // Legacy indicators have empty availableGeographies; availability is defined
    // on the sector. The indicator must end up carrying the city uids.
    const meta = {
      ...META,
      indicators: [{ uid: 'urbclim-T2M-mean', label: 'Mean daily temperature', sector: 'urban-climate', availableGeographies: [], parameters: {} }],
      sectors: [{ uid: 'urban-climate', label: 'Urban heat stress', availableGeographies: ['accra', 'amman'] }],
    };
    const out = buildAvoidMeta(meta, DESCRIPTIONS);
    expect(out.indicators[0].availableGeographies).toEqual(['accra', 'amman']);
  });
});
