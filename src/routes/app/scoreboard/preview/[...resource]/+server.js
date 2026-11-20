import { json } from '@sveltejs/kit';
import { catalogApiUrl } from '$utils/apis.js';
import { enrichChart } from '$lib/server/charts.js';
import { CATALOG_TIMEOUT_MS, HEAVY_TIMEOUT_MS, withRequestDeadline } from '$lib/requests/index.js';

const noStore = { 'Cache-Control': 'no-store' };

export const POST = async ({ fetch, request, url, params }) => {
  const [kind, chartId, extra] = params.resource.split('/');
  const chart = kind === 'charts' && chartId && !['.', '..'].includes(chartId) && extra === undefined;
  if (!chart && !['definition', 'map'].includes(params.resource)) {
    return json({ error: 'Preview resource not found' }, { status: 404, headers: noStore });
  }
  const resource = chart ? `charts/${encodeURIComponent(chartId)}` : kind;
  const timeoutMs = kind === 'definition' ? CATALOG_TIMEOUT_MS : HEAVY_TIMEOUT_MS;

  try {
    const { response, body } = await withRequestDeadline(async ({ signal }) => {
      const response = await fetch(`${catalogApiUrl(`scoreboard/${resource}`)}${url.search}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: await request.text(),
        signal,
      });
      const body = response.body ? await response.text() : null;
      return { response, body };
    }, { signal: request.signal, timeoutMs });

    if (chart && response.ok && body !== null) {
      return json(await enrichChart(JSON.parse(body), fetch, { signal: request.signal }), { headers: noStore });
    }
    const headers = new Headers(noStore);
    headers.set('Content-Type', response.headers.get('content-type') ?? 'application/json');
    const requestId = response.headers.get('x-request-id');
    if (requestId) headers.set('x-request-id', requestId);
    return new Response(body, { status: response.status, headers });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499, headers: noStore });
    if (error?.name === 'TimeoutError') {
      return json({ error: 'The preview request timed out.' }, { status: 504, headers: noStore });
    }
    return json({ error: 'Preview data could not be loaded.' }, { status: 502, headers: noStore });
  }
};
