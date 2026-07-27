import { describe, test, expect } from 'bun:test';
import { citationsByModel } from './facets';

describe('citationsByModel', () => {
  test('keys citations by model name, case-insensitively', () => {
    const map = citationsByModel([
      { model: 'MESMER', key: 'Model Information', value: 'MESMER (Beusch et al., 2020)' },
      { model: 'MESMER', key: 'References', value: 'Schwaab et al., in prep.' },
    ]);
    expect(map.get('mesmer')).toEqual({
      model: 'MESMER (Beusch et al., 2020)',
      source: 'Schwaab et al., in prep.',
    });
  });

  test('keeps models apart', () => {
    const map = citationsByModel([
      { model: 'MESMER', key: 'Model Information', value: 'MESMER (Beusch)' },
      { model: 'MESMER-M', key: 'Model Information', value: 'MESMER-M (Nath)' },
    ]);
    expect(map.get('mesmer')?.model).toBe('MESMER (Beusch)');
    expect(map.get('mesmer-m')?.model).toBe('MESMER-M (Nath)');
  });

  test('drops the "-" placeholder so the footer stays blank instead of showing a dash', () => {
    const map = citationsByModel([
      { model: 'MESMER-M', key: 'Model Information', value: 'MESMER-M (Nath)' },
      { model: 'MESMER-M', key: 'References', value: '-' },
    ]);
    expect(map.get('mesmer-m')).toEqual({ model: 'MESMER-M (Nath)' });
  });

  test('ignores non-citation meta keys', () => {
    const map = citationsByModel([
      { model: 'MESMER', key: 'Temporal Resolution', value: '5 years' },
    ]);
    expect(map.has('mesmer')).toBe(false);
  });
});
