interface Ixmp4Page<T> {
  results: T[];
  total: number;
}

async function getToken(managerUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${managerUrl}/token/obtain/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`ixmp4 auth → ${res.status}`);
  const data = (await res.json()) as { access: string };
  return data.access;
}

async function patch<T>(
  baseUrl: string,
  token: string,
  path: string,
  body: unknown = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ixmp4 ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Ixmp4Datapoint {
  id: number;
  time_series__id: number;
  value: number;
  type: string;
  step_year: number;
}

export interface TimeSeriesProjection {
  yearStart: number;
  yearStep: number;
  data: number[];
}

export async function fetchTimeSeries(
  baseUrl: string,
  managerUrl: string,
  username: string,
  password: string,
  query: { variable: string; runId: number; region?: string },
): Promise<TimeSeriesProjection> {
  const token = await getToken(managerUrl, username, password);
  const body: Record<string, unknown> = {
    variable: { name: query.variable },
    run_id: query.runId,
  };
  if (query.region) body.region = { name: query.region };
  const data = await patch<Ixmp4Page<Ixmp4Datapoint>>(baseUrl, token, '/iamc/datapoints/', body);
  const points = [...data.results].sort((a, b) => a.step_year - b.step_year);
  if (points.length === 0) return { yearStart: 0, yearStep: 0, data: [] };
  const yearStart = points[0].step_year;
  const yearStep = points.length > 1 ? points[1].step_year - points[0].step_year : 0;
  return { yearStart, yearStep, data: points.map((p) => p.value) };
}

export interface ImpactTimeParams {
  indicator: string;
  geography: string;
  scenarios: string[];
}

export interface ImpactTimeResponse {
  yearStart: number;
  yearStep: number;
  title: string;
  description: string;
  model: string;
  source: string;
  parameters: Record<string, unknown>;
  formats: string[];
  data: Record<string, [number, number, number][]>;
}

export async function fetchImpactTime(
  instance: { url: string; managerUrl: string; slug: string },
  creds: { username: string; password: string },
  params: ImpactTimeParams,
): Promise<ImpactTimeResponse> {
  void instance;
  void creds;
  void params;
  throw new Error('fetchImpactTime not yet implemented');
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

export async function fetchEnsemble(
  instance: { url: string; managerUrl: string; slug: string },
  creds: { username: string; password: string },
  params: ImpactTimeParams,
): Promise<EnsembleResponse> {
  void instance;
  void creds;
  void params;
  throw new Error('fetchEnsemble not yet implemented');
}
