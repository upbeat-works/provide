import { json } from '@sveltejs/kit';
import { getScoreboard } from '$routes/(default)/impacts/eu-scoreboard/controller.js';
import { loadMap, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, url }) =>
  json(
    await loadMap({
      scoreboard: getScoreboard(url.searchParams.get('sector'), url.searchParams.get('indicator')),
      fetch,
      selections: selectionsFromUrl(url),
    })
  );
