import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { loadCharts, selectionsFromUrl } from './controller.server.js';

export const load = async ({ fetch, parent, url }) => {
  const { scoreboard } = await parent();
  return { title: generatePageTitle(LABEL_EU_SCOREBOARD), ...(await loadCharts({ scoreboard, fetch, selections: selectionsFromUrl(url) })) };
};
