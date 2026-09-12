import { describe, expect, test, vi } from 'vitest';
import { loadCaseStudyAvoidingTables } from './case-study-avoiding.js';

const indicatorIndex = {
  failedInstances: [],
  indicators: [
    { id: 'Heatwave Days per Year', label: 'Heatwave days', unit: 'days', instance: 'provide-internal' },
    { id: 'Heatwave Days per Year', label: 'Other source', unit: 'days', instance: 'other' },
  ],
};
const curation = {
  likelihoods: [{ uid: '50', value: 50 }],
  studyLocations: [{ uid: 'city-centre', label: 'City centre' }],
};

describe('case-study avoiding tables', () => {
  test('joins the CMS indicator by exact ID and instance and translates only the old API request', async () => {
    const fetch = vi.fn(async (input) => {
      const url = new URL(input);
      expect(url.searchParams.get('indicator')).toBe('urbclim-heatwave-days');
      expect(url.searchParams.has('instance')).toBe(false);
      if (url.pathname.includes('avoiding-reference')) return Response.json({ impact_levels: { range_of_interest: [1, 2] } });
      return Response.json({ study_locations: { 'city-centre': { scenarios: { curpol: { year: '2050' } } } } });
    });

    const tables = await loadCaseStudyAvoidingTables({
      curation,
      dataApiUrl: 'https://legacy.example/api',
      fetch,
      geographyId: 'lisbon',
      indicatorIndex,
      scenarios: [{ id: '2020 Climate Policies', label: 'Policies', instance: 'provide-internal' }],
      section: {
        Indicators: [{ Uid: 'Heatwave Days per Year', Instance: 'provide-internal' }],
        StudyLocations: [{ Uid: 'city-centre' }],
      },
    });

    expect(tables.length).toBe(1);
    expect(tables[0][0].indicator).toMatchObject({ uid: 'Heatwave Days per Year', instance: 'provide-internal' });
  });

  test('does not fall back to an equal ID from another instance', async () => {
    const fetch = vi.fn();
    const tables = await loadCaseStudyAvoidingTables({
      curation,
      dataApiUrl: 'https://legacy.example/api',
      fetch,
      geographyId: 'lisbon',
      indicatorIndex,
      scenarios: [],
      section: { Indicators: [{ Uid: 'Heatwave Days per Year', Instance: 'missing' }], StudyLocations: [{ Uid: 'city-centre' }] },
    });
    expect(tables).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
