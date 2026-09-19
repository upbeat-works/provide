import { describe, test, expect } from 'vitest';
import {
  boundsForGeography,
  classOf,
  colorFor,
  countriesBounds,
  countryFillColor,
  countryFilter,
  scoredCountryFilter,
  scoredUids,
  legendOf,
  numericClasses,
  r9FillColor,
  r9Filter,
  COUNTRY_CODE,
  R9_REGION,
} from './choropleth.js';
import { indicatorValuesFor, RISK_CLASSES, riskRankingFor, riskValues } from './scores.js';

describe('classOf', () => {
  test('picks the last class the value reaches', () => {
    expect(classOf(88, RISK_CLASSES).label).toBe('High');
    expect(classOf(60, RISK_CLASSES).label).toBe('Medium');
    expect(classOf(59.9, RISK_CLASSES).label).toBe('Low');
    expect(classOf(0, RISK_CLASSES).label).toBe('Very Low');
  });

  test('has no class for a missing or non-numeric value', () => {
    expect(classOf(undefined, RISK_CLASSES)).toBeUndefined();
    expect(classOf(null, RISK_CLASSES)).toBeUndefined();
    expect(classOf(NaN, RISK_CLASSES)).toBeUndefined();
    expect(colorFor(undefined, RISK_CLASSES)).toBeUndefined();
  });
});

describe('countryFillColor', () => {
  test('matches each country on the alpha-3 geo id the NUTS features carry', () => {
    const values = [
      { uid: 'ITA', value: 88 },
      { uid: 'IRL', value: 34 },
    ];
    // Colours read off the classes, not repeated here: the ramp is allowed to be
    // restyled, the join key and the shape of the expression are not.
    const high = classOf(88, RISK_CLASSES).color;
    const veryLow = classOf(34, RISK_CLASSES).color;
    expect(countryFillColor(values, RISK_CLASSES)).toEqual(['match', COUNTRY_CODE, 'ITA', high, 'IRL', veryLow, 'transparent']);
  });

  test('leaves unscored countries to the basemap', () => {
    // No case for Morocco, and no value at all means nothing is painted.
    expect(countryFillColor(riskValues, RISK_CLASSES).flat()).not.toContain('MAR');
    expect(countryFillColor([], RISK_CLASSES)).toBe('transparent');
    expect(countryFillColor([{ uid: 'ITA', value: undefined }], RISK_CLASSES)).toBe('transparent');
  });
});

describe('scoredCountryFilter', () => {
  test('draws borders around the scored countries only', () => {
    expect(scoredCountryFilter([{ uid: 'ITA', value: 88 }], RISK_CLASSES)).toEqual(['in', COUNTRY_CODE, ['literal', ['ITA']]]);
  });

  test('covers exactly the countries the fill colours', () => {
    const [, , codes] = scoredCountryFilter(riskValues, RISK_CLASSES);
    expect(codes[1]).toEqual(scoredUids(riskValues, RISK_CLASSES));
    expect(codes[1]).toHaveLength(riskValues.length);
  });

  test('has no id for a value no class covers, so it is neither drawn nor clickable', () => {
    expect(scoredUids([{ uid: 'ITA', value: undefined }], RISK_CLASSES)).toEqual([]);
  });
});

describe('countryFilter', () => {
  test('matches nothing when nothing is passed, so a layer can be switched off', () => {
    expect(countryFilter([])).toEqual(['in', COUNTRY_CODE, ['literal', []]]);
  });
});

describe('countriesBounds', () => {
  const ring = (west, south, east, north) => [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ];
  const country = (geoId, ...boxes) => ({
    type: 'Feature',
    properties: { geoId },
    geometry: boxes.length > 1 ? { type: 'MultiPolygon', coordinates: boxes.map((box) => ring(...box)) } : { type: 'Polygon', coordinates: ring(...boxes[0]) },
  });
  // France as NUTS has it: mainland plus French Guiana and Réunion.
  const shapes = {
    type: 'FeatureCollection',
    features: [country('ESP', [-9, 36, 4, 44]), country('FRA', [-5, 41, 9, 51], [-54, 2, -51, 6], [55, -21, 56, -20])],
  };

  test('measures a country for framing, and knows nothing of one it has no shape for', () => {
    expect(countriesBounds(shapes, ['ESP'])).toEqual([-9, 36, 4, 44]);
    expect(countriesBounds(shapes, ['MAR'])).toBeUndefined();
    expect(countriesBounds(undefined, ['ESP'])).toBeUndefined();
  });

  test('frames the continental part of a country, not its outermost regions', () => {
    // The whole of France spans the Atlantic to the Indian Ocean; framing on
    // that would leave Europe a smudge in the corner.
    expect(countriesBounds(shapes, ['FRA'])).toEqual([-5, 41, 9, 51]);
    expect(countriesBounds(shapes, ['ESP', 'FRA'])).toEqual([-9, 36, 9, 51]);
  });

  test('falls back to the true extent when nothing is continental', () => {
    const overseas = { type: 'FeatureCollection', features: [country('GUF', [-54, 2, -51, 6])] };
    expect(countriesBounds(overseas, ['GUF'])).toEqual([-54, 2, -51, 6]);
  });
});

describe('indicatorValuesFor', () => {
  const valueOf = (values, uid) => values.find((entry) => entry.uid === uid).value;

  test('gives a comparison two sides that differ', () => {
    const policies = indicatorValuesFor({ scenario: '2020 Climate Policies', year: 2025 });
    const targets = indicatorValuesFor({ scenario: '2020 Climate Targets', year: 2025 });
    expect(valueOf(policies, 'ESP')).not.toBe(valueOf(targets, 'ESP'));
    expect(indicatorValuesFor({ year: 2025 })).not.toEqual(indicatorValuesFor({ year: 2026 }));
  });

  test('reads the selection whether it arrives as an id or as an option object', () => {
    // The pages hold the selection as { uid, label }; passing that must not
    // collapse every scenario onto the same nudge.
    const asObjects = indicatorValuesFor({ scenario: { uid: 'SSP1-1.9' }, year: { uid: 2030 } });
    expect(asObjects).toEqual(indicatorValuesFor({ scenario: 'SSP1-1.9', year: 2030 }));
  });

  test('keeps every pair of scenarios apart, not just most of them', () => {
    // A weak hash collides, and two scenarios that collide hand a comparison
    // two identical maps.
    const uids = ['2020 Climate Policies', '2020 Climate Targets', 'SSP1-1.9', 'SSP5-3.4-Overshoot', 'Low Demand', 'High Renewables', 'Shifting Pathway'];
    const drawn = uids.map((scenario) => JSON.stringify(indicatorValuesFor({ scenario, year: 2025 })));
    expect(new Set(drawn).size).toBe(uids.length);
  });

  test('is deterministic, and covers the same countries as the base values', () => {
    const once = indicatorValuesFor({ scenario: 'SSP1-1.9', year: 2018 });
    expect(once).toEqual(indicatorValuesFor({ scenario: 'SSP1-1.9', year: 2018 }));
    expect(once.map((entry) => entry.uid)).toEqual(riskValues.map((entry) => entry.uid));
  });
});

describe('legendOf', () => {
  test('reads low to high by default, high first for the ranking panel', () => {
    expect(legendOf(RISK_CLASSES).labels).toEqual(['Very Low', 'Low', 'Medium', 'High']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).labels).toEqual(['High', 'Medium', 'Low', 'Very Low']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).scale[0]).toBe(RISK_CLASSES.at(-1).color);
  });
});

describe('numeric indicator map scale', () => {
  test('includes zero and negative values in readable numeric classes', () => {
    const classes = numericClasses([{ value: -2 }, { value: 0 }, { value: 8 }, { value: null }], 'K');
    expect(classes).toHaveLength(5);
    expect(classOf(-2, classes)).toBe(classes[0]);
    expect(classOf(0, classes)).toBeDefined();
    expect(classes.every(({ label }) => label.includes('K'))).toBe(true);
  });

  test('uses one honest class for equal values and none for missing values', () => {
    expect(numericClasses([{ value: 0 }, { value: 0 }], '%')).toEqual([{ min: 0, label: '0 %', color: '#ee9f3f' }]);
    expect(numericClasses([{ value: null }])).toEqual([]);
  });

  test('builds the R9 match expression and keeps empty overlays transparent', () => {
    const classes = numericClasses([{ value: 4 }]);
    expect(r9FillColor([{ uid: 'European Union (R9)', value: 4 }], classes)).toEqual(['match', R9_REGION, 'European Union (R9)', '#ee9f3f', 'transparent']);
    expect(r9FillColor([], classes)).toBe('transparent');
    expect(r9Filter([], classes)).toEqual(['in', R9_REGION, ['literal', []]]);
    expect(boundsForGeography('r9')).toEqual([-180, -60, 180, 85]);
    // The country map draws NUTS, so it opens on Europe rather than the world.
    expect(boundsForGeography('admin0')).toEqual([-12, 34, 34, 61]);
  });
});

describe('riskRankingFor', () => {
  test('ranks the same values the map is coloured from, highest first', () => {
    const ranking = riskRankingFor();
    expect(ranking).toHaveLength(riskValues.length);
    expect(ranking[0]).toMatchObject({ rank: 1 });
    expect(ranking.map((e) => e.value)).toEqual([...riskValues.map((e) => e.value)].sort((a, b) => b - a));
  });

  test('reorders under a comparison, so two rankings side by side differ', () => {
    const a = riskRankingFor({ scenario: '2020 Climate Policies' });
    const b = riskRankingFor({ scenario: '2020 Climate Targets' });
    expect(a.map((e) => e.uid)).not.toEqual(b.map((e) => e.uid));
    // Scores stay whole, and on their own scale however far they are nudged.
    expect(b.every(({ value }) => value >= 0 && value <= 100 && Number.isInteger(value))).toBe(true);
  });
});
