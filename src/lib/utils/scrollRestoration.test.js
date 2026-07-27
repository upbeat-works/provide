import { describe, test, expect } from 'bun:test';
import { resolveScrollAction, settleStep, SETTLE_FRAMES, MAX_SETTLE_ATTEMPTS } from './scrollRestoration.js';

const target = (href) => ({ url: new URL(href, 'https://provide.test') });

const explore = target('/impacts/explore');
const exploreFiltered = target('/impacts/explore?indicator=tas&geography=lisbon');
const exploreAnchored = target('/impacts/explore#impact-geo');
const avoid = target('/impacts/avoid');
const methodology = target('/methodology');

describe('link navigation between pages', () => {
  test('lands at the top of the new page', () => {
    expect(resolveScrollAction({ type: 'link', from: explore, to: methodology })).toEqual({ action: 'top' });
  });

  test('resets even when the previous page was scrolled deep', () => {
    // The bug: the container keeps the outgoing page's scrollTop, so /impacts/avoid
    // opened halfway down. Nothing about the outgoing position may leak through.
    expect(resolveScrollAction({ type: 'link', from: explore, to: avoid, saved: 2400 })).toEqual({ action: 'top' });
  });

  test('goto() and form navigations reset the same way', () => {
    expect(resolveScrollAction({ type: 'goto', from: explore, to: avoid })).toEqual({ action: 'top' });
    expect(resolveScrollAction({ type: 'form', from: explore, to: avoid })).toEqual({ action: 'top' });
  });
});

describe('back and forward', () => {
  test('returns to the remembered position', () => {
    expect(resolveScrollAction({ type: 'popstate', from: avoid, to: explore, saved: 1830 })).toEqual({
      action: 'restore',
      top: 1830,
    });
  });

  test('restores position 0 rather than treating it as "nothing saved"', () => {
    expect(resolveScrollAction({ type: 'popstate', from: avoid, to: explore, saved: 0 })).toEqual({
      action: 'restore',
      top: 0,
    });
  });

  test('falls back to the top when the entry has no remembered position', () => {
    expect(resolveScrollAction({ type: 'popstate', from: avoid, to: explore })).toEqual({ action: 'top' });
  });

  test('the remembered position beats the hash — it is where the user actually was', () => {
    expect(resolveScrollAction({ type: 'popstate', from: avoid, to: exploreAnchored, saved: 1830, hasAnchor: true })).toEqual({
      action: 'restore',
      top: 1830,
    });
  });
});

describe('same page, different query string', () => {
  // Changing an indicator/geography rewrites the URL via urlToState's
  // goto(..., { noScroll: true }). Yanking the reader to the top mid-analysis
  // is the most jarring thing this could do.
  test('keeps the reader where they are', () => {
    expect(resolveScrollAction({ type: 'goto', from: explore, to: exploreFiltered })).toEqual({ action: 'preserve' });
  });

  test('applies in both directions', () => {
    expect(resolveScrollAction({ type: 'goto', from: exploreFiltered, to: explore })).toEqual({ action: 'preserve' });
  });

  test('a different pathname is still a real navigation', () => {
    expect(resolveScrollAction({ type: 'link', from: exploreFiltered, to: avoid })).toEqual({ action: 'top' });
  });
});

describe('deep links', () => {
  test('defers to SvelteKit, which already scrollIntoView()s the target', () => {
    expect(resolveScrollAction({ type: 'link', from: methodology, to: exploreAnchored, hasAnchor: true })).toEqual({
      action: 'anchor',
    });
  });

  test('in-page anchor clicks are deferred too, not reset to the top', () => {
    expect(resolveScrollAction({ type: 'link', from: explore, to: exploreAnchored, hasAnchor: true })).toEqual({
      action: 'anchor',
    });
  });

  test('a hash with no matching element falls back to the normal rules', () => {
    expect(resolveScrollAction({ type: 'link', from: methodology, to: exploreAnchored, hasAnchor: false })).toEqual({
      action: 'top',
    });
  });
});

describe('initial load and reload', () => {
  test('a fresh visit starts at the top', () => {
    expect(resolveScrollAction({ type: 'enter', from: null, to: explore })).toEqual({ action: 'top' });
  });

  test('a reload returns to where the page was left', () => {
    expect(resolveScrollAction({ type: 'enter', from: null, to: explore, saved: 940 })).toEqual({
      action: 'restore',
      top: 940,
    });
  });

  test('a fresh visit to a deep link honours the hash', () => {
    expect(resolveScrollAction({ type: 'enter', from: null, to: exploreAnchored, hasAnchor: true })).toEqual({
      action: 'anchor',
    });
  });
});

describe('navigations that leave the app', () => {
  test('an unknown destination is left alone', () => {
    expect(resolveScrollAction({ type: 'leave', from: explore, to: null })).toEqual({ action: 'preserve' });
  });
});

describe('settling onto a restored position', () => {
  // A restored position is unreachable until the new page is tall enough to hold it,
  // and these pages grow as charts and CMS content stream in. Landing short is exactly
  // the near-miss that reads as wonky, so the retry has to outlast the content.
  const step = (over) => settleStep({ scrollTop: 0, top: 2400, scrollHeight: 5000, lastHeight: 5000, frames: 0, attempts: 0, ...over });

  test('stops as soon as the target is reached', () => {
    expect(step({ scrollTop: 2400 })).toEqual({ done: true });
  });

  test('tolerates sub-pixel rounding rather than spinning out the budget', () => {
    expect(step({ scrollTop: 2399.6 })).toEqual({ done: true });
  });

  test('keeps retrying while the page is still short of the target', () => {
    expect(step({ scrollTop: 1200 })).toEqual({ done: false, frames: 1, lastHeight: 5000 });
  });

  test('gives up once the page has stopped growing and still cannot reach it', () => {
    expect(step({ scrollTop: 1200, frames: SETTLE_FRAMES - 1 })).toEqual({ done: true });
  });

  test('a growing page resets the idle budget — content is still arriving', () => {
    expect(step({ scrollTop: 1200, scrollHeight: 5200, lastHeight: 5000, frames: SETTLE_FRAMES - 1 })).toEqual({
      done: false,
      frames: 0,
      lastHeight: 5200,
    });
  });

  test('a page that shrinks also counts as still settling', () => {
    expect(step({ scrollTop: 1200, scrollHeight: 4800, lastHeight: 5000, frames: SETTLE_FRAMES - 1 })).toEqual({
      done: false,
      frames: 0,
      lastHeight: 4800,
    });
  });

  test('a forever-animating page cannot pin the loop open indefinitely', () => {
    expect(step({ scrollTop: 1200, scrollHeight: 5200, lastHeight: 5000, attempts: MAX_SETTLE_ATTEMPTS })).toEqual({
      done: true,
    });
  });
});
