import { describe, test, expect, beforeEach } from 'bun:test';
import { http, HttpResponse } from 'msw';
import { ManagerAuth, createPlatform, __resetPlatformCache } from './platform';
import { server, testInstance } from './test-helpers';

const OBTAIN = `${testInstance.managerUrl}/token/obtain/`;
const REFRESH = `${testInstance.managerUrl}/token/refresh/`;

describe('ManagerAuth', () => {
  test('obtains a token on the first authentication', async () => {
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: 'access-1', refresh: 'refresh-1' });
      }),
    );

    const auth = new ManagerAuth(testInstance.managerUrl, 'u', 'p');
    await auth.refreshOrObtainAccessToken();

    expect(obtainCalls).toBe(1);
    expect(auth.accessToken).toBe('access-1');
  });

  test('reuses the refresh token instead of re-obtaining (the ~13x cheaper path)', async () => {
    let obtainCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: 'access-obtain', refresh: 'refresh-1' });
      }),
      http.post(REFRESH, async ({ request }) => {
        refreshCalls++;
        // The manager expects the SimpleJWT `refresh` field, not `refresh_token`.
        const body = (await request.json()) as { refresh?: string };
        expect(body.refresh).toBe('refresh-1');
        return HttpResponse.json({ access: 'access-refresh' });
      }),
    );

    const auth = new ManagerAuth(testInstance.managerUrl, 'u', 'p');
    await auth.refreshOrObtainAccessToken(); // cold: obtain
    await auth.refreshOrObtainAccessToken(); // warm: should refresh, not re-obtain

    expect(obtainCalls).toBe(1);
    expect(refreshCalls).toBe(1);
    expect(auth.accessToken).toBe('access-refresh');
  });

  test('falls back to a full obtain when the refresh token is rejected', async () => {
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: `access-${obtainCalls}`, refresh: 'refresh-expired' });
      }),
      // Simulate an expired/invalid refresh token (24h elapsed).
      http.post(REFRESH, () => new HttpResponse(null, { status: 401 })),
    );

    const auth = new ManagerAuth(testInstance.managerUrl, 'u', 'p');
    await auth.refreshOrObtainAccessToken(); // obtain #1, seeds the refresh token
    await auth.refreshOrObtainAccessToken(); // refresh 401s → obtain #2

    expect(obtainCalls).toBe(2);
    expect(auth.accessToken).toBe('access-2');
  });
});

describe('createPlatform (memoized)', () => {
  beforeEach(() => __resetPlatformCache());

  test('reuses one Platform instance across calls for the same instance', async () => {
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: 'access-1', refresh: 'refresh-1' });
      }),
    );

    const p1 = await createPlatform(testInstance, 'test-user', 'test-pass');
    const p2 = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(p1).toBe(p2);
    // The expensive obtain runs once for the process, not once per request.
    expect(obtainCalls).toBe(1);
  });

  test('does not cache a failed build, so the next call retries', async () => {
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        if (obtainCalls === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ access: 'access-1', refresh: 'refresh-1' });
      }),
    );

    await expect(createPlatform(testInstance, 'test-user', 'test-pass')).rejects.toThrow();
    const p = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(p).toBeDefined();
    expect(obtainCalls).toBe(2);
  });
});
