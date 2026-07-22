import { beforeAll, afterEach, afterAll } from 'bun:test';
import { server, teardownTestEnvs, dropStaleTestSchemas, closeTestDb } from './test-helpers';
import { __resetPlatformCache } from './platform';

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await dropStaleTestSchemas();
});
afterEach(async () => {
  server.resetHandlers();
  // Platforms are memoized across requests in production; drop the cache between
  // tests so each starts from a cold auth (and the next test's MSW handlers apply).
  __resetPlatformCache();
  await teardownTestEnvs();
});
afterAll(async () => {
  server.close();
  await closeTestDb();
});
