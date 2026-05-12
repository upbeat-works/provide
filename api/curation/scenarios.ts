import scenariosJson from './scenarios.json' assert { type: 'json' };

// TODO: GMT and emissions trajectories are hardcoded here (ported from the
// legacy `data_out/meta.json`) rather than fetched from ixmp4. The reason:
// each ixmp4 instance may store these series under a different variable name,
// so we can't pin a single name in code that works across instances. Until
// we have a registry that maps (instance, scenario) → (gmtVariable,
// emissionsVariable), the safest path is to keep the curated trajectories
// inline. They are scenario-level metadata used for the scenario badges/
// comparison UI — not user-selected indicators.

export interface ScenarioCuration {
  uid: string;
  label: string;
  source: { label: string; href?: string };
  baseScenario: string;
  characteristics: Record<string, unknown>;
  warmingCategory: string;
  isPrimary: boolean;
  gmt: { yearStart: number; yearStep: number; data: number[][]; unit?: string };
  emissions: {
    yearStart: number;
    yearStep: number;
    data: number[] | null;
    unit?: string;
  };
}

export const scenarios: ScenarioCuration[] = scenariosJson as ScenarioCuration[];

export const scenarioByUid: Record<string, ScenarioCuration> = Object.fromEntries(
  scenarios.map((s) => [s.uid, s]),
);
