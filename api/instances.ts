import type { Ixmp4Instance } from './types';

/**
 * Registry of federated ixmp4 instances.
 *
 * The adapter fans out catalogue queries (meta, filters) to all registered
 * instances and merges results. Data queries (impact-time, unavoidable-risk)
 * are routed to a specific instance based on the indicator's source.
 *
 * For now this is a static config. Could move to a DB table or env-based
 * config later for dynamic registration.
 */
export const instances: Ixmp4Instance[] = [
  // {
  //   id: 'climate-analytics',
  //   name: 'Climate Analytics',
  //   url: 'https://ixmp4-ca.example.com',
  // },
];
