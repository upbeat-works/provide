import { loadGeographies, loadCatalog, loadCuration } from '$utils/apis.js';

// The impacts section (explore + avoid) is where the controls and charts live,
// so the data slices load here — not on the global layout. Static pages stay free
// of the expensive ixmp4 catalog scan.
/** @type {import('./$types').LayoutServerLoad} */
export async function load({ fetch }) {
  const [geographies, catalog, curation] = await Promise.all([
    loadGeographies(fetch),
    loadCatalog(fetch),
    loadCuration(fetch),
  ]);
  return { geographies, catalog, curation };
}
