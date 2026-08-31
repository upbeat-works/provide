import { describe, test, expect } from 'bun:test';
import { findCaseStudy, toCaseStudyLink } from './case-study-link.js';

const caseStudies = [
  { slug: 'lisbon', covers: ['Lisbon', 'Berlin', 'Portugal'], isDefault: true },
  { slug: 'islamabad', covers: ['Islamabad', 'Dhaka'], isDefault: false },
  { slug: 'nassau', covers: ['Nassau', 'Bogota'], isDefault: false },
  { slug: 'adaptation', covers: [], isDefault: false },
];

const city = (id, geoId) => ({ uid: id, label: id, geoId, geographyType: 'cities' });
const lisbon = city('Lisbon', 'lisbon');
const dhaka = city('Dhaka', 'dhaka');
const bogota = city('Bogota', 'bogota');
const oslo = city('Oslo', 'oslo');
const portugal = { uid: 'Portugal', label: 'Portugal', geoId: 'PRT', geographyType: 'admin0' };
const europe = { uid: 'continent:Europe', label: 'Europe', geoId: null, geographyType: 'continent' };
const legacyLisbon = { uid: 'lisbon', label: 'Lisbon' };

describe('explicit coverage', () => {
  test('matches a geography listed in covers', () => {
    expect(findCaseStudy(caseStudies, dhaka)?.slug).toBe('islamabad');
    expect(findCaseStudy(caseStudies, bogota)?.slug).toBe('nassau');
  });

  test('a case study covers its own subject', () => {
    expect(findCaseStudy(caseStudies, lisbon)?.slug).toBe('lisbon');
  });

  test('works for non-city geographies (admin0), not just cities', () => {
    expect(findCaseStudy(caseStudies, portugal)?.slug).toBe('lisbon');
  });

  test('explicit coverage beats the default', () => {
    expect(findCaseStudy(caseStudies, dhaka)?.slug).not.toBe('lisbon');
  });

  test('matches on the legacy geoId as well as the catalog id', () => {
    const byGeoId = [{ slug: 'islamabad', covers: ['dhaka'], isDefault: false }];
    expect(findCaseStudy(byGeoId, dhaka)?.slug).toBe('islamabad');
  });

  test('matches a legacy avoid city, whose uid is the lowercase geoId', () => {
    expect(findCaseStudy(caseStudies, legacyLisbon)?.slug).toBe('lisbon');
  });

  test('never joins on slug — a slug that looks like a geography id is not a match', () => {
    const slugOnly = [{ slug: 'Oslo', covers: [], isDefault: false }];
    expect(findCaseStudy(slugOnly, oslo)).toBeNull();
  });
});

describe('default fallback', () => {
  test('an uncovered geography falls back to the default case study', () => {
    expect(findCaseStudy(caseStudies, oslo)?.slug).toBe('lisbon');
  });

  test('the fallback applies to any geography type', () => {
    expect(findCaseStudy(caseStudies, europe)?.slug).toBe('lisbon');
  });

  test('returns null when nothing is covered and no default is flagged', () => {
    const noDefault = caseStudies.map((s) => ({ ...s, isDefault: false }));
    expect(findCaseStudy(noDefault, oslo)).toBeNull();
  });

  test('a case study covering nothing and not default is never linked', () => {
    const hits = [lisbon, dhaka, bogota, oslo, portugal, europe].map((g) => findCaseStudy(caseStudies, g)?.slug).filter(Boolean);
    expect(hits).not.toContain('adaptation');
  });
});

describe('tolerance', () => {
  test('tolerates missing inputs', () => {
    expect(findCaseStudy(undefined, lisbon)).toBeNull();
    expect(findCaseStudy(caseStudies, undefined)).toBeNull();
    expect(findCaseStudy(caseStudies, {})).toBeNull();
    expect(findCaseStudy([], lisbon)).toBeNull();
  });

  test('tolerates a case study with no covers array', () => {
    expect(findCaseStudy([{ slug: 'x', isDefault: true }], lisbon)?.slug).toBe('x');
  });
});

describe('toCaseStudyLink', () => {
  test('maps a Strapi entry onto the link shape', () => {
    expect(
      toCaseStudyLink({
        attributes: {
          Slug: 'lisbon',
          Title: 'Extreme heat in Lisbon',
          Abstract: 'abstract',
          IsDefault: true,
          Covers: [{ GeographyId: 'Berlin' }, { GeographyId: 'Portugal' }],
          CoverImage: { data: { attributes: { url: '/x.png' } } },
        },
      })
    ).toEqual({
      slug: 'lisbon',
      title: 'Extreme heat in Lisbon',
      covers: ['Berlin', 'Portugal'],
      isDefault: true,
      abstract: 'abstract',
      category: 'CASE STUDY',
      image: { url: '/x.png' },
    });
  });

  test('defaults an entry with no Covers / IsDefault / image', () => {
    const out = toCaseStudyLink({ attributes: { Slug: 'adaptation', Title: 'Adaptation' } });
    expect(out.covers).toEqual([]);
    expect(out.isDefault).toBe(false);
    expect(out.image).toBeNull();
  });

  test('tolerates a malformed entry', () => {
    expect(toCaseStudyLink(undefined).covers).toEqual([]);
  });
});
