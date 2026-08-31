import { loadGeographies } from '$utils/apis.js';

// Only the shared, cheap geography tree loads here. Explore loads the (expensive)
// ixmp4 catalog in its own page loader; avoid loads the frozen legacy /meta in
// its. So the avoid page never triggers the ixmp4 catalog scan, and never needs
// the new-API curation slice (it sources likelihoods/study-locations from the
// legacy /meta). Geographies stay shared: explore renders the tree, avoid needs
// the city list for the case-study cross-link.
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ fetch }) {
  const geographies = await loadGeographies(fetch);
  return { geographies };
}
