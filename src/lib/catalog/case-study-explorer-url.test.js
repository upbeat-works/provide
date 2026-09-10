import { describe, expect, test } from 'vitest';
import { safeCaseStudyExplorerUrl } from './case-study-explorer-url.js';

const indicatorIndex = {
  indicators: [{ id: 'Heat', instance: 'primary' }],
  failedInstances: [],
};

describe('case-study Explorer URL', () => {
  test('keeps a source-bound canonical indicator choice', () => {
    const href = '/impacts/explore?indicator=Heat&instance=primary&geography=PT001';

    expect(safeCaseStudyExplorerUrl(href, indicatorIndex)).toBe(href);
  });

  test.each([
    ['a missing instance', '/impacts/explore?indicator=Heat&geography=PT001'],
    ['a legacy indicator ID', '/impacts/avoid?indicator=urbclim-WBGT-dayover295&instance=primary&geography=lisbon'],
    ['an unknown instance', '/impacts/explore?indicator=Heat&instance=unknown&geography=PT001'],
  ])('omits an indicator choice with %s', (_, href) => {
    expect(safeCaseStudyExplorerUrl(href, indicatorIndex)).toBeUndefined();
  });

  test('omits a choice whose selected source failed', () => {
    const partialIndex = { ...indicatorIndex, failedInstances: [{ instance: 'primary', code: 'unavailable' }] };

    expect(safeCaseStudyExplorerUrl('/impacts/explore?indicator=Heat&instance=primary', partialIndex)).toBeUndefined();
  });

  test.each(['/impacts/explore?geography=PT001', '/impacts/avoid#comparison'])('keeps an intended internal path without an indicator choice: %s', (href) => {
    expect(safeCaseStudyExplorerUrl(href, indicatorIndex)).toBe(href);
  });

  test.each([
    ['a JavaScript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html,unsafe'],
    ['a protocol-relative URL', '//evil.example/impacts/explore'],
    ['an external origin', 'https://evil.example/impacts/explore'],
    ['an absolute internal URL', 'https://provide.local/impacts/explore'],
    ['an unrelated internal path', '/about'],
    ['a malformed absolute URL', 'http://[::1'],
    ['a malformed relative URL', '/impacts/expl\nore'],
  ])('omits %s even without an indicator choice', (_, href) => {
    expect(safeCaseStudyExplorerUrl(href, indicatorIndex)).toBeUndefined();
  });
});
