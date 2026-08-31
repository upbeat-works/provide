import { loadGeographies, loadCatalog, loadCuration } from '$utils/apis.js';

// The key-terms (scenarios explainer) page renders the scenario catalog and the
// selection state stores, so it needs the catalog slice; geographies + curation
// load too so the shared state stores resolve without selection.
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ fetch }) {
  const [geographies, catalog, curation] = await Promise.all([
    loadGeographies(fetch),
    loadCatalog(fetch),
    loadCuration(fetch),
  ]);
  return { geographies, catalog, curation };
}
