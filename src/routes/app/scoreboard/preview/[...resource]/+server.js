import { json } from '@sveltejs/kit';
import { catalogApiUrl } from '$utils/apis.js';
import { enrichChart } from '$routes/(default)/impacts/eu-scoreboard/controller.server.js';

export const POST = async ({ fetch, request, url, params }) => {
  const [kind, chartId, extra] = params.resource.split('/');
  const chart = kind === 'charts' && chartId && !['.', '..'].includes(chartId) && extra === undefined;
  if (!chart && !['definition', 'map'].includes(params.resource)) return json({ error: 'Preview resource not found' }, { status: 404 });
  const resource = chart ? `charts/${encodeURIComponent(chartId)}` : kind;
  const response = await fetch(`${catalogApiUrl(`scoreboard/${resource}`)}${url.search}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });
  if (chart && response.ok) {
    return json(await enrichChart(await response.json(), fetch), { headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
