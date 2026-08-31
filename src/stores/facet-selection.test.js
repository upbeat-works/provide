import { test, expect, describe } from 'bun:test';
import { facetQuery, toggleFacetValue, clearFacetGroup, activeFacetGroupCount } from './facet-selection.js';

describe('facetQuery', () => {
  test('no selection produces no query', () => {
    expect(facetQuery({})).toBe('');
    expect(facetQuery({ 'Temporal Resolution': [] })).toBe('');
  });

  test('encodes keys and values, comma-joining within a group', () => {
    const query = facetQuery({ 'Temporal Resolution': ['5 years', 'Annual'] });
    expect(new URLSearchParams(query).get('Temporal Resolution')).toBe('5 years,Annual');
  });

  test('emits one param per group', () => {
    const params = new URLSearchParams(
      facetQuery({ 'Temporal Resolution': ['Annual'], 'Spatial Resolution': ['Global'] }),
    );
    expect(params.get('Temporal Resolution')).toBe('Annual');
    expect(params.get('Spatial Resolution')).toBe('Global');
  });

  test('skips empty groups so a cleared filter does not restrict', () => {
    expect(facetQuery({ 'Temporal Resolution': ['Annual'], 'Data Source': [] })).toBe(
      facetQuery({ 'Temporal Resolution': ['Annual'] }),
    );
  });
});

describe('toggleFacetValue', () => {
  test('adds a value to an untouched group', () => {
    expect(toggleFacetValue({}, 'Temporal Resolution', 'Annual')).toEqual({
      'Temporal Resolution': ['Annual'],
    });
  });

  test('accumulates values within a group (OR)', () => {
    const once = toggleFacetValue({}, 'Temporal Resolution', 'Annual');
    expect(toggleFacetValue(once, 'Temporal Resolution', '5 years')).toEqual({
      'Temporal Resolution': ['Annual', '5 years'],
    });
  });

  test('removes a selected value', () => {
    const filters = { 'Temporal Resolution': ['Annual', '5 years'] };
    expect(toggleFacetValue(filters, 'Temporal Resolution', 'Annual')).toEqual({
      'Temporal Resolution': ['5 years'],
    });
  });

  test('drops the group entirely once its last value is removed', () => {
    const filters = { 'Temporal Resolution': ['Annual'] };
    expect(toggleFacetValue(filters, 'Temporal Resolution', 'Annual')).toEqual({});
  });

  test('does not mutate the input', () => {
    const filters = { 'Temporal Resolution': ['Annual'] };
    toggleFacetValue(filters, 'Temporal Resolution', '5 years');
    expect(filters).toEqual({ 'Temporal Resolution': ['Annual'] });
  });

  test('leaves other groups untouched', () => {
    const filters = { 'Temporal Resolution': ['Annual'], 'Spatial Resolution': ['Global'] };
    expect(toggleFacetValue(filters, 'Temporal Resolution', 'Annual')).toEqual({
      'Spatial Resolution': ['Global'],
    });
  });
});

describe('clearFacetGroup', () => {
  test('removes only the named group', () => {
    const filters = { 'Temporal Resolution': ['Annual'], 'Spatial Resolution': ['Global'] };
    expect(clearFacetGroup(filters, 'Temporal Resolution')).toEqual({ 'Spatial Resolution': ['Global'] });
  });

  test('clearing an unselected group is a no-op', () => {
    expect(clearFacetGroup({ 'Spatial Resolution': ['Global'] }, 'Data Source')).toEqual({
      'Spatial Resolution': ['Global'],
    });
  });
});

describe('activeFacetGroupCount', () => {
  test('counts groups, not values', () => {
    expect(activeFacetGroupCount({ 'Temporal Resolution': ['Annual', '5 years'] })).toBe(1);
    expect(activeFacetGroupCount({ 'Temporal Resolution': ['Annual'], 'Data Source': ['x'] })).toBe(2);
  });

  test('ignores empty groups', () => {
    expect(activeFacetGroupCount({ 'Temporal Resolution': [] })).toBe(0);
    expect(activeFacetGroupCount({})).toBe(0);
  });
});
