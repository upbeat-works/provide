import { loadFromStrapi } from '$utils/apis.js';
import { generatePageTitle } from '$utils/meta.js';
import { kebabCase } from 'lodash-es';
import { parse } from 'marked';
import { LABEL_DOCUMENTATION } from '$config';

// Shared loader for the flat methodology tabs (Models, Data processing): fetch a
// single type whose `Sections` is a list of {Title, Text} and shape it for render.
export async function loadSectionsTab(fetch, endpoint) {
  const entry = await loadFromStrapi(endpoint, fetch);
  const sections = (entry?.attributes?.Sections ?? [])
    .map(({ Title, Text }) => ({
      slug: kebabCase(Title),
      title: (Title ?? '').trim(),
      description: parse(Text ?? ''),
    }))
    .filter(({ title, description }) => title && description);
  return { title: generatePageTitle(LABEL_DOCUMENTATION), sections };
}
