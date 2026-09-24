import { load as loadLanding } from '../../+page.server.js';
import { generatePageTitle } from '$utils/meta.js';

export const load = async (event) => ({
  ...await loadLanding(event),
  title: generatePageTitle('SPARCCLE'),
});
