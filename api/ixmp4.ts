export interface Ixmp4Variable {
  id: number;
  name: string;
}

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
  const data = await res.json() as { access: string };
  return data.access;
}

async function patch<T>(baseUrl: string, token: string, path: string, body: unknown = {}): Promise<T> {
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

export async function fetchVariables(
  baseUrl: string,
  managerUrl: string,
  username: string,
  password: string,
  search?: string
): Promise<Ixmp4Variable[]> {
  const token = await getToken(managerUrl, username, password);
  const filter = search ? { name__ilike: `*${search}*` } : {};
  const data = await patch<Ixmp4Page<Ixmp4Variable>>(baseUrl, token, '/iamc/variables/', filter);
  return data.results;
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
  void instance; void creds; void params;
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
  void instance; void creds; void params;
  throw new Error('fetchEnsemble not yet implemented');
}
