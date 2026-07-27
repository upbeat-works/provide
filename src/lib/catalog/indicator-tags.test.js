import { test, expect, describe } from 'bun:test';
import { sectorLabel, indicatorTags } from './indicator-tags.js';

describe('sectorLabel', () => {
  test('title-cases a slug', () => {
    expect(sectorLabel('terrestrial-climate')).toBe('Terrestrial Climate');
    expect(sectorLabel('urban-climate')).toBe('Urban Climate');
  });

  test('handles a single word', () => {
    expect(sectorLabel('biodiversity')).toBe('Biodiversity');
  });

  test('returns empty for nothing', () => {
    expect(sectorLabel(undefined)).toBe('');
    expect(sectorLabel(null)).toBe('');
    expect(sectorLabel('')).toBe('');
  });
});

describe('indicatorTags', () => {
  test('orders sector, models, project', () => {
    expect(
      indicatorTags({
        sector: 'terrestrial-climate',
        models: ['MESMER (Beusch et al., 2020, 2022)'],
        project: 'PROVIDE',
      }),
    ).toEqual(['Terrestrial Climate', 'MESMER (Beusch et al., 2020, 2022)', 'PROVIDE']);
  });

  test('keeps the model citation string verbatim', () => {
    expect(indicatorTags({ models: ['MESMER-M (Nath et al., 2022)'] })).toEqual([
      'MESMER-M (Nath et al., 2022)',
    ]);
  });

  test('leaves sources out — they belong to the chart footer', () => {
    expect(
      indicatorTags({ models: ['MESMER'], sources: ['Schwaab et al., in prep.'], project: 'PROVIDE' }),
    ).toEqual(['MESMER', 'PROVIDE']);
  });

  test('omits whatever is missing rather than leaving gaps', () => {
    expect(indicatorTags({ models: ['MESMER'], project: 'PROVIDE' })).toEqual(['MESMER', 'PROVIDE']);
    expect(indicatorTags({ sector: 'biodiversity' })).toEqual(['Biodiversity']);
  });

  test('an indicator with nothing to show yields no tags', () => {
    expect(indicatorTags({})).toEqual([]);
    expect(indicatorTags(undefined)).toEqual([]);
  });

  test('lists several models', () => {
    expect(indicatorTags({ models: ['MESMER', 'MESMER-M'] })).toEqual(['MESMER', 'MESMER-M']);
  });

  test('de-duplicates repeated values', () => {
    expect(indicatorTags({ models: ['MESMER', 'MESMER'] })).toEqual(['MESMER']);
  });

  test('ignores blank entries', () => {
    expect(indicatorTags({ models: ['', '  ', 'MESMER'] })).toEqual(['MESMER']);
  });
});
