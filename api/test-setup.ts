import { beforeAll, afterEach, afterAll } from 'bun:test';
import { server, teardownTestEnvs, dropStaleTestSchemas, closeTestDb } from './test-helpers';

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await dropStaleTestSchemas();
});
afterEach(async () => {
  server.resetHandlers();
  await teardownTestEnvs();
});
afterAll(async () => {
  server.close();
  await closeTestDb();
});
