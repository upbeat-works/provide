import { describe, expect, test } from 'bun:test';
import { instances } from '../instances';
import { parseRequiredInstance } from './contracts';

describe('parseRequiredInstance', () => {
  const configuredInstance = instances.find(({ slug }) => slug === 'provide-internal');

  test.each([
    { value: undefined, expected: { status: 400, error: 'instance is required' } },
    { value: 'unknown', expected: { status: 404, error: 'Unknown instance: unknown' } },
    { value: 'provide-internal', expected: configuredInstance },
  ])('returns the matching result for $value', ({ value, expected }) => {
    expect(parseRequiredInstance(value)).toEqual(expected);
  });
});
