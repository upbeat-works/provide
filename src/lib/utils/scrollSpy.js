function findScrollParent(el) {
  while (el && el !== document.documentElement) {
    const { overflow, overflowY } = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(overflow + overflowY)) return el;
    el = el.parentElement;
  }
  return document.documentElement;
}

/**
 * Creates a scroll-spy instance attached to a container element.
 *
 * @param {Element} node - The container element to observe.
 * @param {object} opts
 * @param {() => (Element|string|null)[]} opts.getItems
 *   Called on every scroll tick. Return an array whose indices match the indices
 *   you want passed to onActive. Items can be DOM Elements, id strings, or null
 *   (nulls are skipped so you can align with a full array including disabled items).
 * @param {(index: number) => void} opts.onActive - Called with the index of the active item.
 * @returns {{ destroy: () => void, click: (index: number) => void }}
 */
export function createScrollSpy(node, { getItems, onActive }) {
  let isClickScrolling = false;
  const scrollContainer = findScrollParent(node);

  function update() {
    if (isClickScrolling) return;
    const midpoint = window.innerHeight / 2;
    getItems().forEach((item, i) => {
      if (!item) return;
      const el = item instanceof Element ? item : document.getElementById(item);
      if (el && el.getBoundingClientRect().top <= midpoint) onActive(i);
    });
  }

  function onUserScroll() { isClickScrolling = false; }

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      scrollContainer.addEventListener('scroll', update, { passive: true });
      scrollContainer.addEventListener('wheel', onUserScroll, { passive: true });
      scrollContainer.addEventListener('touchmove', onUserScroll, { passive: true });
      update();
    } else {
      scrollContainer.removeEventListener('scroll', update);
      scrollContainer.removeEventListener('wheel', onUserScroll);
      scrollContainer.removeEventListener('touchmove', onUserScroll);
    }
  });
  observer.observe(node);

  function destroy() {
    observer.disconnect();
    scrollContainer.removeEventListener('scroll', update);
    scrollContainer.removeEventListener('wheel', onUserScroll);
    scrollContainer.removeEventListener('touchmove', onUserScroll);
  }

  function click(i) {
    isClickScrolling = true;
    onActive(i);
  }

  return { destroy, click };
}
