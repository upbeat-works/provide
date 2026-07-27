/**
 * Scroll restoration for a page whose scroll container is an element, not the window.
 *
 * The default layout wraps the app in `h-screen` + `overflow-y-auto`, so the document
 * never scrolls — that div does. SvelteKit's built-in restoration drives `window.scrollTo`
 * and stores `pageYOffset`, all of which is a no-op here: new pages opened at whatever
 * scrollTop the previous page left behind, and back/forward never returned anywhere.
 * This module does the same job against the container.
 */

// SvelteKit tags each history entry with a monotonic index. Keying off it (rather than
// the URL) means two visits to the same URL remember their own positions.
const HISTORY_INDEX = 'sveltekit:history';
const STORAGE_KEY = 'provide:scroll';

// A restored position is only reachable once the new page is tall enough to hold it, and
// these pages grow as charts and CMS content settle in. Re-apply for a few frames rather
// than landing short — that near-miss is what reads as "wonky".
export const SETTLE_FRAMES = 20;

// Absolute ceiling (~3s at 60fps) so a page that animates forever can't pin the loop open.
export const MAX_SETTLE_ATTEMPTS = 180;

/**
 * One frame of the restore retry loop: have we arrived, and is it still worth trying?
 *
 * Pure so the give-up conditions — the subtle part — can be tested without a DOM.
 *
 * @returns {{ done: true } | { done: false, frames: number, lastHeight: number }}
 */
export function settleStep({ scrollTop, top, scrollHeight, lastHeight, frames, attempts }) {
  // Browsers report fractional scroll offsets on scaled displays; an exact match would
  // burn the whole budget waiting for equality that never comes.
  if (Math.abs(scrollTop - top) < 1) return { done: true };
  if (attempts >= MAX_SETTLE_ATTEMPTS) return { done: true };

  // The page changing height means content is still arriving, so the target may simply
  // not be reachable yet — that's not an idle frame, so don't spend the budget on it.
  if (scrollHeight !== lastHeight) return { done: false, frames: 0, lastHeight: scrollHeight };

  if (frames + 1 >= SETTLE_FRAMES) return { done: true };
  return { done: false, frames: frames + 1, lastHeight: scrollHeight };
}

const INTERRUPTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

/**
 * @typedef {{ url: URL }} NavTarget
 * @typedef {{ action: 'restore', top: number } | { action: 'top' } | { action: 'preserve' } | { action: 'anchor' }} ScrollAction
 */

/**
 * Decides what a completed navigation should do to the scroll container.
 *
 * Pure, and deliberately mirrors SvelteKit's own precedence so the two never disagree
 * about a given navigation.
 *
 * @param {object} nav
 * @param {string} nav.type - SvelteKit navigation type: enter/link/goto/form/popstate/leave.
 * @param {NavTarget|null} [nav.from]
 * @param {NavTarget|null} [nav.to]
 * @param {number} [nav.saved] - Position remembered for the destination history entry.
 * @param {boolean} [nav.hasAnchor] - Whether the destination hash resolves to an element.
 * @returns {ScrollAction}
 */
export function resolveScrollAction({ type, from, to, saved, hasAnchor = false }) {
  // Leaving the app, or a destination we can't reason about: don't touch anything.
  if (!to) return { action: 'preserve' };

  // Back/forward and reloads land on an entry we've seen before, so the remembered
  // position wins — including over a hash, because it's where the user actually was.
  if (type === 'popstate' || type === 'enter') {
    if (typeof saved === 'number') return { action: 'restore', top: saved };
    return hasAnchor ? { action: 'anchor' } : { action: 'top' };
  }

  // SvelteKit already called scrollIntoView() on the target, which walks scroll parents
  // and so works on the container. Don't fight it.
  if (hasAnchor) return { action: 'anchor' };

  // Same page, different query string: the indicator/geography controls rewriting the URL
  // through urlToState's `goto(..., { noScroll: true })`. Yanking the reader to the top
  // mid-analysis is the most jarring thing this could do.
  if (from && from.url.pathname === to.url.pathname) return { action: 'preserve' };

  return { action: 'top' };
}

/** sessionStorage is unavailable in private modes and some embeds; degrade to memory. */
function createStore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return {
      positions: raw ? JSON.parse(raw) : {},
      persist(positions) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
        } catch {
          /* quota or disabled — in-memory restoration still works for this session */
        }
      },
    };
  } catch {
    return { positions: {}, persist() {} };
  }
}

function historyIndex() {
  return history.state?.[HISTORY_INDEX] ?? 0;
}

/** Resolves a hash to its target, matching SvelteKit's own deep-link lookup. */
function anchorFor(hash) {
  if (!hash) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    // Malformed percent-encoding — treat it as a hash that points nowhere.
    return null;
  }
}

/**
 * Wires container-based scroll restoration. Call `handle` from `afterNavigate`.
 *
 * @param {HTMLElement} container - The element that actually scrolls.
 * @returns {{ handle: (nav: object) => void, destroy: () => void }}
 */
export function createScrollRestoration(container) {
  const store = createStore();
  const { positions } = store;

  // Tracked rather than read live: on popstate the browser has already swapped
  // history.state by the time we hear about the navigation, so reading it then would
  // file the outgoing page's position under the incoming entry.
  let currentIndex = historyIndex();
  let frame = 0;
  let settling = false;

  // Recording continuously (instead of in beforeNavigate) sidesteps that ordering
  // question entirely — the outgoing position is already banked before we're told.
  //
  // Suppressed mid-restore: until the page is tall enough, every scrollTo clamps short
  // and would otherwise overwrite the very position we're trying to get back to.
  const record = () => {
    if (settling) return;
    positions[currentIndex] = container.scrollTop;
  };

  const stopSettling = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (settling) {
      settling = false;
      record();
    }
  };

  // `instant` overrides the container's CSS `scroll-behavior: smooth`, so restoring is a
  // jump while anchor clicks stay animated.
  const scrollTo = (top) => container.scrollTo({ top, behavior: 'instant' });

  function settleTo(top) {
    stopSettling();
    settling = true;

    let frames = 0;
    let attempts = 0;
    let lastHeight = container.scrollHeight;

    const step = () => {
      scrollTo(top);
      const next = settleStep({
        scrollTop: container.scrollTop,
        top,
        scrollHeight: container.scrollHeight,
        lastHeight,
        frames,
        attempts: (attempts += 1),
      });

      if (next.done) {
        stopSettling();
        return;
      }

      ({ frames, lastHeight } = next);
      frame = requestAnimationFrame(step);
    };

    step();
  }

  const persist = () => store.persist(positions);

  function handle(nav) {
    const index = historyIndex();
    const action = resolveScrollAction({
      type: nav?.type,
      from: nav?.from,
      to: nav?.to,
      saved: positions[index],
      hasAnchor: Boolean(anchorFor(nav?.to?.url?.hash)),
    });

    currentIndex = index;

    if (action.action === 'restore') {
      settleTo(action.top);
    } else if (action.action === 'top') {
      stopSettling();
      scrollTo(0);
    } else {
      // 'anchor' and 'preserve': leave the container alone, but stop any in-flight
      // settle from the previous navigation clawing the position back.
      stopSettling();
    }

    record();
  }

  container.addEventListener('scroll', record, { passive: true });
  // On window, not the container: the container isn't focusable, so key-driven scrolling
  // (space, PageDown) targets <body> and would never reach a listener bound to it.
  INTERRUPTS.forEach((event) => window.addEventListener(event, stopSettling, { passive: true }));
  window.addEventListener('pagehide', persist);

  function destroy() {
    stopSettling();
    persist();
    container.removeEventListener('scroll', record);
    INTERRUPTS.forEach((event) => window.removeEventListener(event, stopSettling));
    window.removeEventListener('pagehide', persist);
  }

  return { handle, destroy };
}
