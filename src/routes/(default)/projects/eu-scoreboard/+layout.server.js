import { loadCatalog } from '$utils/apis.js';

// Both scoreboard views carry the scenario selector, so the catalog slice — the
// scenario universe it offers — is loaded once here rather than per view. It is
// the expensive ixmp4 scan, so it stays on the sections that need it (see the
// catalog-slices note in CLAUDE.md) and off the global layout.
export const load = async ({ fetch }) => ({
  catalog: await loadCatalog(fetch),
});
