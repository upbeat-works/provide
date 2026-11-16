import { describe, expect, test } from 'vitest';
import { safeCaseStudyEmbedUrl } from './case-study-embed-url.js';

describe('case-study embed URL', () => {
  test('keeps a site-relative embed link and marks it inline', () => {
    expect(safeCaseStudyEmbedUrl('/embed/impact-time?indicator=Heat&instance=primary&geography=PT001&scenarios=CurrentPolicies')).toBe(
      '/embed/impact-time?indicator=Heat&instance=primary&geography=PT001&scenarios=CurrentPolicies&inline=true'
    );
  });

  test('reduces an absolute link copied from any PROVIDE host to its path', () => {
    expect(safeCaseStudyEmbedUrl('https://climate-risk-dashboard.iiasa.ac.at/embed/impact-geo?indicator=Heat&year=2050')).toBe(
      '/embed/impact-geo?indicator=Heat&year=2050&inline=true'
    );
  });

  test.each(['impact-time', 'impact-geo', 'unavoidable-risk', 'eu-scoreboard-chart'])('accepts the %s embed', (embed) => {
    expect(safeCaseStudyEmbedUrl(`/embed/${embed}`)).toBe(`/embed/${embed}?inline=true`);
  });

  test.each([
    ['nothing', undefined],
    ['an empty string', '  '],
    ['a JavaScript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,unsafe'],
    ['a protocol-relative URL', '//evil.example/embed/impact-time'],
    ['an unknown embed', '/embed/something-else'],
    ['a nested embed path', '/embed/impact-time/extra'],
    ['a non-embed page', '/impacts/explore?indicator=Heat'],
    ['a control character', '/embed/impact-time?\nindicator=Heat'],
  ])('rejects %s', (_, href) => {
    expect(safeCaseStudyEmbedUrl(href)).toBeUndefined();
  });
});
