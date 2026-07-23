import { loadGeographies, loadCatalog, loadCuration } from '$utils/apis.js';

// Adaptation case studies resolve cities, indicators, scenarios, likelihoods and
// study locations server-side, so all three slices load for this section.
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ fetch }) {
  const [geographies, catalog, curation] = await Promise.all([
    loadGeographies(fetch),
    loadCatalog(fetch),
    loadCuration(fetch),
  ]);
  return { geographies, catalog, curation };
}
