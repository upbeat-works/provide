import { json } from '@sveltejs/kit';
import { loadScoreboardDefinition } from '$utils/apis.js';
import { loadMap, selectionsFromUrl } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const GET = async ({ fetch, url }) =>
  json(
    await loadMap({
      scoreboard: await loadScoreboardDefinition(fetch, { sector: url.searchParams.get('sector') ?? undefined, indicator: url.searchParams.get('indicator') ?? undefined }),
      fetch,
      selections: selectionsFromUrl(url),
    })
  );
