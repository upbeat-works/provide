import { describe, test, expect } from 'bun:test';
import { flagEmoji, iconOf } from './flags.js';

describe('flagEmoji', () => {
  test('maps an alpha-3 code to its flag', () => {
    expect(flagEmoji('EGY')).toBe('🇪🇬');
    expect(flagEmoji('ARG')).toBe('🇦🇷');
    expect(flagEmoji('CHE')).toBe('🇨🇭');
  });

  test('handles the catalog codes that are not the country ISO3', () => {
    expect(flagEmoji('PSX')).toBe('🇵🇸'); // Palestine
    expect(flagEmoji('SAH')).toBe('🇪🇭'); // Western Sahara
    expect(flagEmoji('SDS')).toBe('🇸🇸'); // South Sudan
  });

  test('returns undefined for codes with no rendered flag', () => {
    expect(flagEmoji('KOS')).toBeUndefined(); // XK is not ISO-assigned
    expect(flagEmoji('BVT')).toBeUndefined(); // uninhabited, not in the recommended set
  });

  test('returns undefined for a non-country geo id or none at all', () => {
    expect(flagEmoji('liberia')).toBeUndefined(); // an EEZ slug, not a country
    expect(flagEmoji('nile')).toBeUndefined();
    expect(flagEmoji(undefined)).toBeUndefined();
  });
});

describe('iconOf', () => {
  test('prefers a catalog-supplied icon over the flag', () => {
    expect(iconOf({ icon: '🏙', geoId: 'EGY' })).toBe('🏙');
    expect(iconOf({ emoji: '🏙', geoId: 'EGY' })).toBe('🏙');
  });

  test('falls back to the flag of the geo id', () => {
    expect(iconOf({ geoId: 'EGY' })).toBe('🇪🇬');
  });

  test('returns undefined when there is nothing to show', () => {
    expect(iconOf({ geoId: 'cairo' })).toBeUndefined();
    expect(iconOf(undefined)).toBeUndefined();
  });
});
