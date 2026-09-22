import { fromArrayBuffer } from 'geotiff';
import type { RasterMapIndicator } from './types';

function metadata(definition: RasterMapIndicator) {
  return definition.unit ? { unit: definition.unit } : null;
}

export function emptyRasterMapResult(definition: RasterMapIndicator) {
  return { definition, status: 'empty' as const, values: [], grid: null, metadata: metadata(definition) };
}

export async function rasterMapResult(response: Response, definition: RasterMapIndicator) {
  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const boundingBox = image.getBoundingBox();
  const resolutionX = (boundingBox[2] - boundingBox[0]) / width;
  const resolutionY = (boundingBox[3] - boundingBox[1]) / height;
  if (Math.abs(resolutionX - resolutionY) > 1e-9) throw new Error('GeoServer returned non-square scoreboard cells');
  const raster = await image.readRasters({ interleave: true, samples: [0] });
  if (raster.length !== width * height) throw new Error('GeoServer returned an unexpected scoreboard raster size');

  const rawNoData = image.getGDALNoData();
  const noData = rawNoData == null ? undefined : Number(rawNoData);
  const data: Array<Array<number | null>> = Array.from({ length: width }, () => Array(height).fill(null));
  for (let row = 0; row < height; row += 1) {
    const latitude = height - row - 1;
    for (let column = 0; column < width; column += 1) {
      const value = Number(raster[row * width + column]);
      data[column][latitude] = !Number.isFinite(value) || value === noData ? null : value;
    }
  }
  const hasValues = data.some((column) => column.some(Number.isFinite));
  return {
    definition,
    status: hasValues ? 'ready' as const : 'empty' as const,
    grid: {
      coordinatesOrigin: [boundingBox[0] + resolutionX / 2, boundingBox[1] + resolutionY / 2],
      resolution: resolutionX,
      data,
    },
    metadata: metadata(definition),
  };
}
