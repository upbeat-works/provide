import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';
import { chartsForRegion } from '../../../../../../api/scoreboard/choices.js';

export const load = async ({ parent }) => {
  const { scoreboard, selection } = await parent();
  const title = generatePageTitle(`Explore indicators – ${LABEL_EU_SCOREBOARD}`);
  let map;
  if (scoreboard.indicator) map = { definition: scoreboard.indicator, status: 'loading' };
  const charts = chartsForRegion(scoreboard.charts, selection.region?.uid).map((definition) => ({ definition, result: { definition, status: 'loading' } }));
  return { title, map, charts };
};
