// The advanced-filter facets. Keys are static (we only surface the ones the UI
// has a group for); their values are discovered from the data.
//
// Two sources: `run` keys are ixmp4 run meta; `indicator` keys are per-indicator
// attributes that are not run meta at all — Sector is curated in the DB and
// Project is the ixmp4 instance.
export const FACET_KEYS = [
  { key: 'Sector', label: 'SECTOR', color: 'grass', source: 'indicator' },
  { key: 'Project', label: 'PROJECT', color: 'pink', source: 'indicator' },
  { key: 'Data Source', label: 'DATA SOURCE', color: 'gray', source: 'run' },
  { key: 'Spatial Resolution', label: 'SPATIAL RESOLUTION', color: 'orange', source: 'run' },
  { key: 'Temporal Resolution', label: 'TEMPORAL', color: 'sky', source: 'run' },
] as const;

const RUN_KEYS = FACET_KEYS.filter((f) => f.source === 'run').map((f) => f.key);

// Per-run display strings, read by the chart footer — never facets.
export const CITATION_KEYS = { model: 'Model Information', source: 'References' } as const;

import type { Platform } from '@iiasa/ixmp4-ts';
import { parseVariable } from './conventions';

export type FacetFilters = Record<string, string[]>;
/** Opaque per-instance-unique run key (`<instance>#<runId>`). */
export type RunKey = string;
/** run -> { tagKey -> value } */
export type RunTags = Map<RunKey, Record<string, string>>;
/** run -> indicator uids carried by that run */
export type RunIndicators = Map<RunKey, string[]>;
/** indicator uid -> its non-run facet values (Sector, Project) */
export type IndicatorAttrs = Map<string, Record<string, string | undefined>>;

export interface FacetOption {
  value: string;
  count: number;
}

export interface FacetSelection {
  runIds: RunKey[];
  indicators: Set<string>;
  facets: Record<string, FacetOption[]>;
}

function runsMatching(runTags: RunTags, filters: FacetFilters, exceptKey?: string): RunKey[] {
  const active = Object.entries(filters).filter(([k, vs]) => k !== exceptKey && vs.length);
  const ids: RunKey[] = [];
  for (const [runId, tags] of runTags) {
    if (active.every(([k, vs]) => vs.includes(tags[k]))) ids.push(runId);
  }
  return ids;
}

function indicatorsOf(runIndicators: RunIndicators, runIds: RunKey[]): Set<string> {
  const out = new Set<string>();
  for (const id of runIds) for (const ind of runIndicators.get(id) ?? []) out.add(ind);
  return out;
}

/**
 * Resolve the active filters into the matching runs, their indicators, and the
 * facet options to render. Each facet's options are scoped by the *other*
 * active filters, so selecting a value never empties its own group. Counts are
 * distinct indicators, matching what the list shows. Pure.
 */
export function resolveFacetSelection(
  runTags: RunTags,
  runIndicators: RunIndicators,
  filters: FacetFilters,
  indicatorAttrs: IndicatorAttrs = new Map(),
): FacetSelection {
  // The indicators surviving a filter set: run-level keys are matched per run
  // (so an AND across them means one run carries both), then intersected with
  // the indicator-level keys. `pin` forces one extra key=value on top.
  const select = (active: FacetFilters, pin?: { key: string; value: string }): Set<string> => {
    const runFilters: FacetFilters = {};
    const indFilters: FacetFilters = {};
    for (const [key, values] of Object.entries(active)) {
      if (!values?.length) continue;
      (RUN_KEYS.includes(key as never) ? runFilters : indFilters)[key] = values;
    }
    if (pin) {
      (RUN_KEYS.includes(pin.key as never) ? runFilters : indFilters)[pin.key] = [pin.value];
    }

    const fromRuns = indicatorsOf(runIndicators, runsMatching(runTags, runFilters));
    const indEntries = Object.entries(indFilters);
    if (!indEntries.length) return fromRuns;
    return new Set(
      [...fromRuns].filter((uid) => {
        const attrs = indicatorAttrs.get(uid) ?? {};
        return indEntries.every(([key, values]) => values.includes(attrs[key] as string));
      }),
    );
  };

  const facets: Record<string, FacetOption[]> = {};
  for (const { key, source } of FACET_KEYS) {
    // Every value the data has for this key stays listed, so an option the
    // other filters exclude renders muted at 0 rather than disappearing.
    const allValues = new Set<string>();
    if (source === 'run') {
      for (const tags of runTags.values()) if (tags[key] !== undefined) allValues.add(tags[key]);
    } else {
      for (const attrs of indicatorAttrs.values()) {
        if (attrs[key] !== undefined) allValues.add(attrs[key] as string);
      }
    }

    // The group is scoped by every OTHER active filter, never by its own.
    const others = Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key));
    facets[key] = [...allValues]
      .map((value) => ({ value, count: select(others, { key, value }).size }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }

  return { runIds: runsMatching(runTags, filters), indicators: select(filters), facets };
}

export interface RunFacetData {
  runTags: RunTags;
  runIndicators: RunIndicators;
  /** run -> citation strings for the chart footer. */
  citations: Map<RunKey, { model?: string; source?: string }>;
}

/**
 * The I/O edge: read every run's meta and its indicators, keyed per instance so
 * run ids from different platforms can't collide.
 */
export async function fetchRunFacetData(
  platforms: Array<{ instance: { slug: string }; platform: Platform }>,
): Promise<RunFacetData> {
  const runTags: RunTags = new Map();
  const runIndicators: RunIndicators = new Map();
  const citations: RunFacetData['citations'] = new Map();

  await Promise.all(
    platforms.map(async ({ instance, platform }) => {
      const runs = await platform.runs.list();
      const key = (runId: number) => `${instance.slug}#${runId}`;

      const meta = await platform.meta.tabulate({ joinRunIndex: false });
      const runIds = meta.columnValues('run__id') as number[];
      const keys = meta.columnValues('key') as string[];
      const values = meta.columnValues('value') as unknown[];
      keys.forEach((k, i) => {
        const rk = key(runIds[i]);
        const value = String(values[i]);
        if (k === CITATION_KEYS.model) citations.set(rk, { ...citations.get(rk), model: value });
        else if (k === CITATION_KEYS.source) citations.set(rk, { ...citations.get(rk), source: value });
        else runTags.set(rk, { ...(runTags.get(rk) ?? {}), [k]: value });
      });

      await Promise.all(
        runs.map(async (run) => {
          const rk = key(run.id);
          if (!runTags.has(rk)) runTags.set(rk, {});
          const names = (await platform.iamc.variables.list({ run: { id_in: [run.id] } })).map((v) => v.name);
          runIndicators.set(rk, [...new Set(names.map((n) => parseVariable(n).indicator))]);
        }),
      );
    }),
  );

  return { runTags, runIndicators, citations };
}

export interface IndicatorCitations {
  models: string[];
  sources: string[];
}

/**
 * Roll the per-run citation strings up to the indicators those runs carry.
 * Placeholder values (`-`) are dropped — they mean "none recorded".
 */
export function citationsByIndicator(
  runIndicators: RunIndicators,
  citations: Map<RunKey, { model?: string; source?: string }>,
): Map<string, IndicatorCitations> {
  const out = new Map<string, IndicatorCitations>();
  const usable = (value?: string) => Boolean(value && value.trim() && value.trim() !== '-');

  for (const [runKey, indicators] of runIndicators) {
    const citation = citations.get(runKey);
    if (!citation) continue;
    for (const indicator of indicators) {
      const entry = out.get(indicator) ?? { models: [], sources: [] };
      if (usable(citation.model) && !entry.models.includes(citation.model!)) entry.models.push(citation.model!);
      if (usable(citation.source) && !entry.sources.includes(citation.source!)) entry.sources.push(citation.source!);
      out.set(indicator, entry);
    }
  }
  return out;
}

/**
 * Citations keyed by the model name the datapoint rows carry, for the chart
 * footer (which knows a model/scenario, not a run id). Pure.
 */
export function citationsByModel(
  rows: Array<{ model: string; key: string; value: string }>,
): Map<string, { model?: string; source?: string }> {
  const out = new Map<string, { model?: string; source?: string }>();
  for (const { model, key, value } of rows) {
    if (!model || !value || value.trim() === '-') continue;
    const id = model.toLowerCase();
    const entry = out.get(id) ?? {};
    if (key === CITATION_KEYS.model) entry.model = value;
    else if (key === CITATION_KEYS.source) entry.source = value;
    else continue;
    out.set(id, entry);
  }
  return out;
}

/** I/O edge for {@link citationsByModel}: one joined meta tabulate. */
export async function fetchCitationsByModel(platform: Platform) {
  const df = await platform.meta.tabulate({});
  const models = df.columnValues('model') as string[];
  const keys = df.columnValues('key') as string[];
  const values = df.columnValues('value') as unknown[];
  return citationsByModel(
    keys.map((key, i) => ({ model: models[i], key, value: String(values[i]) })),
  );
}

/** `terrestrial-climate` -> `Terrestrial Climate`. Slugs are stored; labels are shown. */
export function sectorLabel(sector?: string | null): string | undefined {
  if (!sector) return undefined;
  return sector
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
