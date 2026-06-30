/** @type {import('./$types').LayoutServerLoad} */
export async function load() {
  // The data slices (geographies / catalog / curation) are loaded by the
  // sections that use them (impacts, adaptation, methodology/key-terms), not
  // here — so static pages (about, contact, …) don't pay for the ixmp4 catalog.
  const buildDate = new Date();
  return {
    buildDate,
  };
}
