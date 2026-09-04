import { loadCatalog, loadGeographies } from '$utils/apis.js';

// The slices the scoreboard's filters need, loaded once here rather than per
// view: the catalog for the scenario universe (the expensive ixmp4 scan, so it
// stays on the sections that need it — see the catalog-slices note in
// CLAUDE.md — and off the global layout), and geographies for the country list
// (pure D1, cheap).
export const load = async ({ fetch }) => {
  const [catalog, geographies] = await Promise.all([loadCatalog(fetch), loadGeographies(fetch)]);
  return { catalog, geographies };
};
