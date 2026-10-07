import { describe, test, expect } from 'vitest';
import bbox from '@turf/bbox';
import {
  classOf,
  formatValue,
  colorFor,
  countriesBounds,
  countryFillColor,
  countryFilter,
  scoredCountryFilter,
  scoredUids,
  legendOf,
  numericClasses,
  countryValues,
  rampColors,
  isRamp,
  DEFAULT_RAMP,
  rasterFeatures,
  COUNTRY_CODE,
} from './choropleth.js';
import { RISK_CLASSES, riskRankingFor, riskValues } from './scores.js';

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

describe('legendOf', () => {
  test('reads low to high by default, high first for the ranking panel', () => {
    expect(legendOf(RISK_CLASSES).labels).toEqual(['Very Low', 'Low', 'Medium', 'High']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).labels).toEqual(['High', 'Medium', 'Low', 'Very Low']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).scale[0]).toBe(RISK_CLASSES.at(-1).color);
  });

  test('shows numeric class boundaries once instead of repeating interval ends', () => {
    const classes = numericClasses([{ value: 1 }, { value: 3 }], '°C');

    expect(legendOf(classes, { labelMode: 'boundaries', unit: '°C' }).ticks).toEqual([
      '1', '1.5', '2', '2.5', '3 °C',
    ]);
  });
});

describe('numeric indicator map scale', () => {
  test('spans zero and negative values in four buckets labelled with their range', () => {
    const classes = numericClasses([{ value: -2 }, { value: 0 }, { value: 8 }, { value: null }]);
    // Equal width over the range the values actually span: -2 to 8 in steps of 2.5.
    // Numbers only — the panel's subtitle names the unit.
    expect(classes.map(({ label }) => label)).toEqual(['-2–0.5', '0.5–3', '3–5.5', '5.5–8']);
    expect(classes.map(({ min }) => min)).toEqual([-2, 0.5, 3, 5.5]);
    expect(classOf(-2, classes)).toBe(classes[0]);
    expect(classOf(8, classes)).toBe(classes[3]);
  });

  test('walks the ramp from one endpoint to the other', () => {
    const classes = numericClasses([{ value: 0 }, { value: 100 }]);
    expect(classes.map(({ color }) => color)).toEqual(['#fedb5c', '#f5bb55', '#eb9b4e', '#e27b47']);
  });

  test('uses one honest class for equal values and none for missing values', () => {
    expect(numericClasses([{ value: 0 }, { value: 0 }], '%')).toEqual([{ min: 0, max: 0, label: '0 %', color: '#f5bb55' }]);
    expect(numericClasses([{ value: null }])).toEqual([]);
  });

});

describe('rasterFeatures', () => {
  test('turns finite raster cells into coloured map rectangles and leaves missing cells empty', () => {
    const classes = numericClasses([{ value: 1 }, { value: 2 }, { value: 3 }], '°C');
    const result = rasterFeatures({ coordinatesOrigin: [10, 50], resolution: 2, data: [[1, null], [2, 3]] }, classes);

    expect(result.features).toHaveLength(3);
    expect(result.features[0]).toEqual({
      type: 'Feature',
      properties: { value: 1, color: colorFor(1, classes) },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9, 49], [11, 49], [11, 51], [9, 51], [9, 49]]],
      },
    });
    expect(result.features[2].properties).toEqual({ value: 3, color: colorFor(3, classes) });
  });

  test('returns no cells without a usable grid', () => {
    expect(rasterFeatures(undefined, [])).toEqual({ type: 'FeatureCollection', features: [] });
  });

  test('clips painted cells to the selected country', () => {
    const classes = numericClasses([{ value: 1 }], '°C');
    const mask = {
      type: 'Feature',
      properties: { geoId: 'DEU' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[9.5, 49.5], [10.5, 49.5], [10.5, 50.5], [9.5, 50.5], [9.5, 49.5]]],
      },
    };
    const result = rasterFeatures({ coordinatesOrigin: [10, 50], resolution: 2, data: [[1]] }, classes, mask);

    expect(result.features).toHaveLength(1);
    expect(bbox(result.features[0])).toEqual([9.5, 49.5, 10.5, 50.5]);
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

describe('custom colour ramps from a sector definition', () => {
  test('walks a two-stop ramp end to end', () => {
    expect(rampColors(['#000000', '#ffffff'], 4)).toEqual(['#000000', '#555555', '#aaaaaa', '#ffffff']);
  });

  test('passes through the middle stop of a diverging ramp', () => {
    // Five buckets over two spans puts bucket three exactly on the midpoint.
    expect(rampColors(['#000000', '#ff0000', '#ffffff'], 5)).toEqual(['#000000', '#800000', '#ff0000', '#ff8080', '#ffffff']);
  });

  test('keeps the default ramp when the configured one is unusable', () => {
    const fallback = rampColors(DEFAULT_RAMP);
    expect(rampColors(['#ffffff'])).toEqual(fallback); // one stop cannot span
    expect(rampColors(['red', 'blue'])).toEqual(fallback); // named colours
    expect(rampColors(['#fff', '#000'])).toEqual(fallback); // shorthand hex
    expect(rampColors(undefined)).toEqual(fallback);
  });

  test('recognises only full six-digit hex as a ramp', () => {
    expect(isRamp(['#FEDB5C', '#E27B47'])).toBe(true);
    expect(isRamp(['#fedb5c', '#e27b47', '#123456'])).toBe(true);
    expect(isRamp(['#fedb5c'])).toBe(false);
    expect(isRamp(['#fedb5c', '#nothex'])).toBe(false);
    expect(isRamp('#fedb5c')).toBe(false);
    expect(isRamp(undefined)).toBe(false);
  });

  test("colours an indicator's classes with its configured ramp", () => {
    const values = [{ value: 0 }, { value: 100 }];
    expect(numericClasses(values, undefined, ['#000000', '#ffffff']).map(({ color }) => color)).toEqual(['#000000', '#555555', '#aaaaaa', '#ffffff']);
    // Boundaries are unaffected by the ramp.
    expect(numericClasses(values, undefined, ['#000000', '#ffffff']).map(({ min }) => min)).toEqual(numericClasses(values).map(({ min }) => min));
  });

  test('falls back to the default ramp when an indicator sets none', () => {
    const values = [{ value: 0 }, { value: 100 }];
    expect(numericClasses(values).map(({ color }) => color)).toEqual(numericClasses(values, undefined, DEFAULT_RAMP).map(({ color }) => color));
    expect(numericClasses(values, undefined, ['oops']).map(({ color }) => color)).toEqual(numericClasses(values).map(({ color }) => color));
  });
});

describe('map value labels', () => {
  test('preserves small nonzero values in tooltips and legend boundaries', () => {
    expect(formatValue(0.00326)).toBe('0.00326');
    expect(formatValue(-0.000071)).toBe('-0.000071');
    expect(formatValue(0)).toBe('0');
    const classes = numericClasses([{ value: 0.003 }, { value: 0.004 }], 'million');
    expect(legendOf(classes, { labelMode: 'boundaries' }).ticks).toEqual(['0.003', '0.00325', '0.0035', '0.00375', '0.004']);
  });
});

describe('countryValues', () => {
  const countries = [{ name: 'Austria', iso3: 'AUT' }, { name: 'France', iso3: 'FRA' }];

  test('keys a map value by the geoId its country layer matches on', () => {
    expect(countryValues([{ region: 'Austria', value: 5 }], countries)).toEqual([{ uid: 'AUT', value: 5 }]);
  });

  test('drops a region that is not one of the countries drawn', () => {
    expect(countryValues([{ region: 'AT11', value: 5 }], countries)).toEqual([]);
  });

  test('leaves values that already carry their own uid alone', () => {
    const scored = [{ uid: 'FRA', value: 2 }];
    expect(countryValues(scored, countries)).toEqual(scored);
  });
});
