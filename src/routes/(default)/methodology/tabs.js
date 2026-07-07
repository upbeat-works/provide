import { PATH_DOCUMENTATION, PATH_KEY_CONCEPTS, LABEL_KEY_CONCEPTS } from '$config';

// The methodology page is split into tabs, each served by its own route under
// /methodology and its own CMS content type (models, data-processing, impact,
// key-terms). Shared here so the tab bar stays identical across every tab.
export const tabItems = [
  { href: `/${PATH_DOCUMENTATION}`, label: 'Impact' },
  { href: `/${PATH_DOCUMENTATION}/models`, label: 'Models' },
  { href: `/${PATH_DOCUMENTATION}/data-processing`, label: 'Data processing' },
  { href: `/${PATH_DOCUMENTATION}/${PATH_KEY_CONCEPTS}`, label: LABEL_KEY_CONCEPTS },
];
