import { loadFromStrapi } from '$utils/apis.js';
import { generatePageTitle } from '$utils/meta.js';
import { kebabCase } from 'lodash-es';
import { parse } from 'marked';
import { LABEL_DOCUMENTATION } from '$config';

// The Impact tab. Its CMS content type (`impact`) stores a flat list of sections
// each tagged with an Impact and a Category; regroup them into the per-impact,
// per-category shape the page renders. First-seen order is preserved.
const CATEGORY_KEY = {
  Models: 'models',
  'Model simulations': 'simulation',
  'Data processing': 'processing',
};

export const load = async ({ fetch }) => {
  const impact = await loadFromStrapi('impact', fetch);
  const title = generatePageTitle(LABEL_DOCUMENTATION);

  const sections = impact?.attributes?.Sections ?? [];
  if (!sections.length) {
    console.warn('No impact sections found. This is likely a Strapi issue. Check if you have rights to access the data.');
    return { title, methodology: [] };
  }

  const order = [];
  const byImpact = new Map();
  for (const { Impact, Category, Title, Text } of sections) {
    const impactTitle = (Impact ?? '').trim();
    const key = CATEGORY_KEY[Category];
    if (!impactTitle || !key) continue;
    if (!byImpact.has(impactTitle)) {
      byImpact.set(impactTitle, {
        title: impactTitle,
        slug: kebabCase(impactTitle),
        models: [],
        simulation: [],
        processing: [],
      });
      order.push(impactTitle);
    }
    const itemTitle = (Title ?? '').trim();
    const description = parse(Text ?? '');
    if (itemTitle && description) {
      byImpact.get(impactTitle)[key].push({ slug: kebabCase(itemTitle), title: itemTitle, description });
    }
  }

  return { title, methodology: order.map((k) => byImpact.get(k)) };
};
