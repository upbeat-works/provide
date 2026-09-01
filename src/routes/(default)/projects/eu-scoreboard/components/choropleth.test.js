import { describe, test, expect } from 'bun:test';
import { classOf, colorFor, countryFillColor, scoredCountryFilter, legendOf, COUNTRY_CODE } from './choropleth.js';
import { RISK_CLASSES, riskRanking, riskValues } from './scores.js';

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
  test('matches each country on its alpha-3 code', () => {
    const values = [
      { uid: 'ITA', value: 88 },
      { uid: 'IRL', value: 34 },
    ];
    expect(countryFillColor(values, RISK_CLASSES)).toEqual(['match', COUNTRY_CODE, ['ITA'], '#5A0F6B', ['IRL'], '#EEBF5E', 'transparent']);
  });

  test('matches the codes the tileset uses where they differ from ours', () => {
    expect(countryFillColor([{ uid: 'KOS', value: 74 }], RISK_CLASSES)[2]).toEqual(['KOS', 'XKX']);
  });

  test('leaves unscored countries to the basemap', () => {
    // No case for Morocco, and no value at all means nothing is painted.
    expect(countryFillColor(riskValues, RISK_CLASSES).flat()).not.toContain('MAR');
    expect(countryFillColor([], RISK_CLASSES)).toBe('transparent');
    expect(countryFillColor([{ uid: 'ITA', value: undefined }], RISK_CLASSES)).toBe('transparent');
  });
});

describe('scoredCountryFilter', () => {
  test('draws borders around the scored countries only, one worldview each', () => {
    const filter = scoredCountryFilter([{ uid: 'ITA', value: 88 }], RISK_CLASSES);
    expect(filter[0]).toBe('all');
    expect(filter[2]).toEqual(['in', COUNTRY_CODE, ['literal', ['ITA']]]);
  });

  test('covers every country the fill colours', () => {
    const [, , codes] = scoredCountryFilter(riskValues, RISK_CLASSES);
    expect(codes[2][1]).toHaveLength(riskValues.length + 1); // Kosovo contributes both spellings
  });
});

describe('legendOf', () => {
  test('reads low to high by default, high first for the ranking panel', () => {
    expect(legendOf(RISK_CLASSES).labels).toEqual(['Very Low', 'Low', 'Medium', 'High']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).labels).toEqual(['High', 'Medium', 'Low', 'Very Low']);
    expect(legendOf(RISK_CLASSES, { highestFirst: true }).scale[0]).toBe('#5A0F6B');
  });
});

describe('riskRanking', () => {
  test('ranks the same values the map is coloured from, highest first', () => {
    expect(riskRanking).toHaveLength(riskValues.length);
    expect(riskRanking[0]).toMatchObject({ rank: 1 });
    expect(riskRanking.map((e) => e.value)).toEqual([...riskValues.map((e) => e.value)].sort((a, b) => b - a));
  });
});
