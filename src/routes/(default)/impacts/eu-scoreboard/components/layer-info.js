import { parseVariable } from '../../../../../../api/conventions.ts';

// What the legend's info modal says about the mapped layer. Every row is
// derived — from the indicator definition, from parsing the ixmp4 variable
// name, or from the row ixmp4 returned. Nothing here is hand-authored, so a
// field the data cannot answer is simply absent rather than filled with a
// placeholder: an empty row would claim the metadata exists and is blank.

const NUTS_LABELS = { NUTS1: 'NUTS-1 regions', NUTS2: 'NUTS-2 regions' };

// A degree of latitude is ~111 km everywhere; a degree of longitude shrinks
// towards the poles, so this is the generous edge of the cell, which is why it
// is shown as an approximation rather than a measurement.
const KM_PER_DEGREE = 111;

const gridResolution = (grid) => {
  const degrees = grid?.resolution;
  if (!Number.isFinite(degrees) || degrees <= 0) return undefined;
  return `${degrees.toFixed(2)}° ≈ ${Math.round(degrees * KM_PER_DEGREE)} km`;
};

/**
 * The pairs for the modal's grid. Rasters and choropleths describe themselves
 * differently — a raster's
 * facets sit on its definition, a choropleth's are encoded in the variable name
 * — so each is read where it actually lives. Both are already prose: a raster's
 * facets are slugified at the GeoServer boundary (`coverageIdSegment`), not in
 * the config, so they are displayed exactly as the sector JSON names them.
 */
export function layerInfo({ definition = {}, metadata = null, grid = null } = {}) {
  const rows = [];
  const add = (label, value) => {
    const text = typeof value === 'number' ? String(value) : String(value ?? '').trim();
    if (text) rows.push({ label, value: text });
  };

  const raster = definition?.type === 'raster';
  const variable = raster ? undefined : metadata?.variable ?? definition?.variable;
  const parsed = variable ? parseVariable(variable) : undefined;

  add('Variable', raster ? definition.indicator : parsed?.indicator);
  add('Unit', metadata?.unit ?? definition?.unit);
  add('Aggregation', raster ? definition.time : parsed?.temporal);
  add('Estimate', parsed?.value?.raw);
  add('Reference period', raster ? definition.reference : parsed?.period);
  add('Spatial basis', raster ? definition.spatial : parsed?.spatial);
  add('Spatial coverage', raster ? gridResolution(grid) : NUTS_LABELS[definition?.level]);
  add('Source', metadata?.model);

  return { rows };
}
