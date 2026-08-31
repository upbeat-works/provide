import { loadGeographies, loadCatalog, loadCuration } from '$utils/apis.js';

// Case studies need the geography tree (city list), the catalog (scenarios +
// indicators for the detail page) and the curation slice ([city] reads it). Like
// the other data sections, this section loads its own slices here rather than in
// the (default) layout, so static pages don't pay for the ixmp4 catalog scan.
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ fetch }) {
  const [geographies, catalog, curation] = await Promise.all([
    loadGeographies(fetch),
    loadCatalog(fetch),
    loadCuration(fetch),
  ]);
  return { geographies, catalog, curation };
}
