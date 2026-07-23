import { loadGeographies, loadCatalog, loadCuration } from '$utils/apis.js';

export const load = async ({ fetch }) => {
  const [geographies, catalog, curation] = await Promise.all([
    loadGeographies(fetch),
    loadCatalog(fetch),
    loadCuration(fetch),
  ]);
  return { geographies, catalog, curation };
};
