import { beforeAll, afterEach, afterAll } from 'bun:test';
import { server, teardownTestEnvs, dropStaleTestSchemas, closeTestDb } from './test-helpers';
import { __resetPlatformCache, __resetPlatformClock } from './platform';
import { __resetCatalogCache } from './routes/catalog';

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await dropStaleTestSchemas();
});
afterEach(async () => {
  server.resetHandlers();
  // Platforms + the catalog payload are memoized across requests in production;
  // drop both between tests so each starts cold (and the next test's DB env +
  // MSW handlers apply, rather than a previous test's cached result).
  __resetPlatformCache();
  __resetPlatformClock();
  __resetCatalogCache();
  await teardownTestEnvs();
});
afterAll(async () => {
  server.close();
  await closeTestDb();
});
