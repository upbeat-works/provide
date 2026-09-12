import { Hono } from 'hono';
import type { Platform } from '@iiasa/ixmp4-ts';
import { parseRequiredInstance, validateCanonicalIndicatorId, type IndicatorDetailsResponse } from '../catalog/contracts';
import { groupIndicatorVariableNames } from '../catalog/availability';
import { indicatorsFromVariables } from '../conventions';
import { indicatorDescriptions } from '../descriptions';
import { CITATION_KEYS, citationsByIndicator, indicatorIdentity, type RunIndicators, type RunKey } from '../facets';
import { createPlatform } from '../platform';
import type { Env, Ixmp4Instance } from '../types';

const indicatorDetails = new Hono<Env>();

function errorType(reason: unknown): string {
  if (reason instanceof Error) return reason.name;
  return 'NonErrorRejection';
}

const parameterDefinitions = [
  { id: 'time', label: 'Time', values: 'temporals' },
  { id: 'reference', label: 'Reference', values: 'periods' },
  { id: 'spatial', label: 'Spatial', values: 'spatials' },
] as const;

async function loadIndicatorDetails(platform: Platform, instance: Ixmp4Instance, id: string): Promise<IndicatorDetailsResponse | null> {
  const variables = await platform.iamc.variables.list({ name_ilike: `${id}|*` });
  const variableGroup = groupIndicatorVariableNames(variables.map(({ name }) => name)).find((group) => group.id === id);
  if (!variableGroup) return null;

  const facets = indicatorsFromVariables(variableGroup.names).find(({ uid }) => uid === id);
  if (!facets) return null;

  const unitVariableNames = variableGroup.percentileNames.length > 0 ? variableGroup.percentileNames : variableGroup.names;
  const variableNames = new Set(variableGroup.names);
  const docsVariable = variables.find((variable) => variableNames.has(variable.name));
  if (!docsVariable) return null;
  const [units, docs, runs] = await Promise.all([
    platform.units.list({ iamc: { variable: { name_in: unitVariableNames } } }),
    platform.backend.iamc.variables.docs.list(docsVariable.id),
    platform.runs.list({ iamc: { variable: { name_in: variableGroup.names } } }),
  ]);
  if (!units[0]) throw new Error(`No unit for indicator ${id}`);

  const runIds = runs.map(({ id: runId }) => runId);
  const runIndicators: RunIndicators = new Map();
  const citationRows = new Map<RunKey, { model?: string; source?: string }>();
  const identity = indicatorIdentity(id, instance.slug);
  for (const runId of runIds) {
    runIndicators.set(`${instance.slug}#${runId}`, [identity]);
  }

  if (runIds.length > 0) {
    const meta = await platform.meta.tabulate({
      joinRunIndex: false,
      key_in: [CITATION_KEYS.model, CITATION_KEYS.source],
      run: { id_in: runIds },
    });
    const metaRunIds = meta.columnValues('run__id') as number[];
    const keys = meta.columnValues('key') as string[];
    const values = meta.columnValues('value') as unknown[];
    keys.forEach((key, index) => {
      const runKey = `${instance.slug}#${metaRunIds[index]}`;
      const value = String(values[index]);
      if (key === CITATION_KEYS.model) {
        citationRows.set(runKey, { ...citationRows.get(runKey), model: value });
      }
      if (key === CITATION_KEYS.source) {
        citationRows.set(runKey, { ...citationRows.get(runKey), source: value });
      }
    });
  }

  const proseById = new Map(docs.map((doc) => [doc.dimension__id, doc.description]));
  const descriptions = indicatorDescriptions(
    variables.map((variable) => ({
      variable: variable.name,
      description: proseById.get(variable.id) ?? '',
    }))
  );
  const citations = citationsByIndicator(runIndicators, citationRows).get(identity);
  const ixmp4Description = descriptions.get(id);

  return {
    id,
    instance: instance.slug,
    unit: units[0].name,
    parameters: parameterDefinitions.map(({ id: parameterId, label, values }) => ({
      id: parameterId,
      label,
      options: facets[values].map((value) => ({ id: value, label: value })),
    })),
    models: citations?.models ?? [],
    sources: citations?.sources ?? [],
    ...(ixmp4Description ? { ixmp4Description } : {}),
  };
}

indicatorDetails.get('/:id', async (c) => {
  const id = c.req.param('id');
  const invalidIndicator = validateCanonicalIndicatorId(id);
  if (invalidIndicator) {
    return c.json({ error: invalidIndicator.error }, invalidIndicator.status);
  }

  const instance = parseRequiredInstance(c.req.query('instance'));
  if ('status' in instance) return c.json({ error: instance.error }, instance.status);

  try {
    const platform = await createPlatform(instance, c.env.IXMP4_USERNAME, c.env.IXMP4_PASSWORD);
    const response = await loadIndicatorDetails(platform, instance, id);
    if (!response) return c.json({ error: `Indicator not found: ${id}` }, 404);
    return c.json(response);
  } catch (reason) {
    console.error('Indicator source unavailable', {
      instance: instance.slug,
      errorType: errorType(reason),
    });
    return c.json({ error: 'Indicator source unavailable' }, 502);
  }
});

export { indicatorDetails };
