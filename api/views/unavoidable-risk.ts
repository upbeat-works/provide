import type { Ixmp4Instance } from '../types';

export interface EnsembleParams {
  indicator: string;
  geography: string;
  scenarios: string[];
}

export interface EnsembleResponse {
  thresholds: number[];
  defaultThreshold: number;
  years: number[];
  today: number[];
  data: Record<string, number[][]>;
  title: string;
  description: string;
  model: string;
  source: string;
  formats: string[];
}

/**
 * The unavoidable-risk (ensemble exceedance) view: probability of crossing each
 * warming threshold over time. Not yet resolvable from ixmp4 — the ensemble
 * variables/regions aren't available on provide-internal — so this stub throws
 * until the data lands. See docs/gmt-open-questions.md.
 */
export async function fetchEnsemble(
  instance: Ixmp4Instance,
  creds: { username: string; password: string },
  params: EnsembleParams,
): Promise<EnsembleResponse> {
  void instance;
  void creds;
  void params;
  throw new Error('fetchEnsemble not yet implemented');
}
