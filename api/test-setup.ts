import { beforeAll, afterEach, afterAll } from 'bun:test';
import { server, teardownTestEnvs, dropStaleTestSchemas, closeTestDb } from './test-helpers';
import { __resetPlatformCache, __resetPlatformClock } from './platform';

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await dropStaleTestSchemas();
});
afterEach(async () => {
  server.resetHandlers();
  __resetPlatformCache();
  __resetPlatformClock();
  await teardownTestEnvs();
});
afterAll(async () => {
  server.close();
  await closeTestDb();
});
