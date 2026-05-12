import { describe, test, expect } from 'bun:test';
import { api } from './index';
import { createTestEnv } from './test-helpers';

describe('GET /api', () => {
  test('returns name and version', async () => {
    const res = await api.request('/api', {}, createTestEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'PROVIDE API', version: '0.1.0' });
  });
});
