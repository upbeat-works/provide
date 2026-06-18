import { beforeAll, afterEach, afterAll } from 'bun:test';
import { server } from './test-helpers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
