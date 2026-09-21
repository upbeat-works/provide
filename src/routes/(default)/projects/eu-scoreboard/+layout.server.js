import { getScoreboard } from './controller.js';
import { loadOptions } from './controller.server.js';

export const load = async ({ url, fetch, depends }) => {
  depends('scoreboard:options');
  const scoreboard = getScoreboard(url.searchParams.get('sector'));
  const selections = { scenario: url.searchParams.get('scenario') ?? undefined, region: url.searchParams.get('region') ?? undefined };
  return { scoreboard, scoreboardOptions: await loadOptions({ scoreboard, fetch, selections }) };
};
