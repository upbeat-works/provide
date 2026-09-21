import { fromArrayBuffer } from 'geotiff';

function isNoData(value, noData) {
  return Number.isNaN(value) || (noData != null && value === noData);
}

export async function loadImpactGeoGrid(url, params, fetcher = fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    let message = `Map request failed with HTTP ${response.status}`;
    let isExpected = false;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json();
      message = body.message ?? body.error ?? message;
      isExpected = body.isExpected === true;
    }
    throw Object.assign(new Error(message), { isExpected });
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('image/tiff') && !contentType.includes('application/octet-stream')) {
    throw new Error('Map request returned an invalid raster response');
  }
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const boundingBox = image.getBoundingBox();
  const resolutionX = (boundingBox[2] - boundingBox[0]) / width;
  const resolutionY = (boundingBox[3] - boundingBox[1]) / height;
  if (Math.abs(resolutionX - resolutionY) > 1e-9) {
    throw new Error('GeoServer returned non-square impact-geo cells');
  }
  const values = await image.readRasters({ interleave: true, samples: [0] });
  if (values.length !== width * height) {
    throw new Error('GeoServer returned an unexpected raster size');
  }
  const rawNoData = image.getGDALNoData();
  const noData = rawNoData == null ? undefined : Number(rawNoData);
  const data = Array.from({ length: width }, () => Array(height).fill(null));
  for (let row = 0; row < height; row += 1) {
    const latitude = height - row - 1;
    for (let column = 0; column < width; column += 1) {
      const value = Number(values[row * width + column]);
      data[column][latitude] = isNoData(value, noData) ? null : value;
    }
  }
  return {
    coordinatesOrigin: [boundingBox[0] + resolutionX / 2, boundingBox[1] + resolutionY / 2],
    resolution: resolutionX, resolutions: [resolutionX], data,
    parameters: { indicator: params.indicator, geography: params.geography, reference: params.reference,
      time: params.time, spatial: params.spatial, scenario: params.scenario, frequency: 0.5 },
    formats: ['netcdf', 'geotiff'], year: params.year, showDifference: false,
  };
}

export async function processMapRequests(requests, post) {
  for (const [index, { url, params }] of requests.entries()) {
    let result;
    try {
      result = { status: 'success', data: await loadImpactGeoGrid(url, params) };
    } catch (error) {
      result = { status: 'failed', message: error instanceof Error ? error.message : String(error), isExpected: error?.isExpected === true };
    }
    post({ index, result });
    if (result.status === 'failed') return;
  }
}
