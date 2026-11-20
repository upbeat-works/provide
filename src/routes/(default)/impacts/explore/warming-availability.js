import { catalogFlow } from '$stores/catalog-flow.js';

export function observeWarmingAvailability(node, { slug, flow = catalogFlow }) {
  if (slug !== 'unavoidable-risk') return;

  let observing = true;
  const observer = new IntersectionObserver(([entry]) => {
    if (observing) flow.setWarmingVisible(entry.isIntersecting);
  });
  observer.observe(node);

  return {
    destroy() {
      observing = false;
      observer.disconnect();
      flow.setWarmingVisible(false);
    },
  };
}
