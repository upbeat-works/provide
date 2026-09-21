import { json } from '@sveltejs/kit';
import { getScoreboard } from '$routes/(default)/projects/eu-scoreboard/controller.js';
import { loadMap, selectionsFromUrl } from '$routes/(default)/projects/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, url }) =>
  json(
    await loadMap({
      scoreboard: getScoreboard(url.searchParams.get('sector')),
      fetch,
      selections: selectionsFromUrl(url),
    })
  );
