import { describe, test, expect } from 'bun:test';
import { toProjectSection } from './landing-project.js';

// What Strapi returns for the `landing-project` single type
// (`populate[Intro][populate]=*&populate[Highlights][populate]=*`).
const entry = {
  id: 1,
  attributes: {
    Title: 'Learn about the Climate Risk\nDashboard project',
    Intro: {
      id: 1,
      Text: 'This platform brings together research from **PROVIDE**, a [Horizon Europe consortium](https://provide-h2020.eu).',
      LinkLabel: 'Learn more',
      LinkUrl: '/about',
    },
    Highlights: {
      id: 2,
      Text: 'The Climate Risk Dashboard combines:',
      Items: [
        { id: 1, Title: 'Projections across scales', Description: 'Country- and grid-level projections.' },
        { id: 2, Title: '(Un)avoidable risk', Description: 'Likelihood of crossing impact levels.' },
      ],
      LinkLabel: 'View methodology',
      LinkUrl: '/methodology',
    },
  },
};

describe('toProjectSection', () => {
  test('splits the title on newlines so editors control the line break', () => {
    expect(toProjectSection(entry).titleLines).toEqual(['Learn about the Climate Risk', 'Dashboard project']);
  });

  test('renders card text as markdown', () => {
    const { intro } = toProjectSection(entry);
    expect(intro.text).toContain('<strong>PROVIDE</strong>');
    expect(intro.text).toContain('href="https://provide-h2020.eu"');
  });

  test('maps a card link only when it has both a label and a url', () => {
    expect(toProjectSection(entry).intro.link).toEqual({ label: 'Learn more', url: '/about' });

    const noUrl = { attributes: { Intro: { Text: 'a', LinkLabel: 'Learn more', LinkUrl: '' } } };
    expect(toProjectSection(noUrl).intro.link).toBeNull();
  });

  test('maps the highlights, and only the highlights card has them', () => {
    const { intro, highlights } = toProjectSection(entry);
    expect(highlights.items).toEqual([
      { title: 'Projections across scales', description: 'Country- and grid-level projections.' },
      { title: '(Un)avoidable risk', description: 'Likelihood of crossing impact levels.' },
    ]);
    expect(intro.items).toEqual([]);
  });

  test('drops highlight items an editor left blank', () => {
    const sparse = {
      attributes: {
        Highlights: { Text: 'kept', Items: [{ Title: '', Description: '' }, { Title: 'Real', Description: 'Yes' }] },
      },
    };
    expect(toProjectSection(sparse).highlights.items).toEqual([{ title: 'Real', description: 'Yes' }]);
  });

  test('a card an editor left empty is null, and the other still renders', () => {
    const introOnly = { attributes: { Title: 'Heading', Intro: { Text: 'kept' } } };
    const section = toProjectSection(introOnly);
    expect(section.intro.text).toContain('kept');
    expect(section.highlights).toBeNull();
  });

  test('returns null when there is nothing to render, so the block is skipped', () => {
    // Strapi answers `data: null` for an unpublished/absent single type, and the
    // loader degrades to null when the CMS is unreachable.
    expect(toProjectSection(null)).toBeNull();
    expect(toProjectSection(undefined)).toBeNull();
    expect(toProjectSection({ attributes: { Title: 'Heading', Intro: null, Highlights: null } })).toBeNull();
  });

  test('accepts an already-flattened entry', () => {
    expect(toProjectSection(entry.attributes).titleLines).toEqual(['Learn about the Climate Risk', 'Dashboard project']);
  });
});
