import { describe, test, expect, beforeEach } from 'bun:test';
import { http, HttpResponse } from 'msw';
import {
  ManagerAuth,
  createPlatform,
  __resetPlatformCache,
  __setPlatformClock,
} from './platform';
import { server, testInstance } from './test-helpers';

const OBTAIN = `${testInstance.managerUrl}/token/obtain/`;
const REFRESH = `${testInstance.managerUrl}/token/refresh/`;

// A minimal signed-looking JWT whose payload carries the given `exp` (seconds).
// ManagerAuth reads expiry straight from the access token.
function jwt(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.sig`;
}

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

  test('ensureFreshToken skips re-auth while the token is valid, then refreshes once it expires', async () => {
    let clock = 0; // ms
    __setPlatformClock(() => clock);
    let obtainCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: jwt(clock / 1000 + 900), refresh: 'refresh-1' });
      }),
      http.post(REFRESH, () => {
        refreshCalls++;
        return HttpResponse.json({ access: jwt(clock / 1000 + 900) });
      }),
    );

    const auth = new ManagerAuth(testInstance.managerUrl, 'u', 'p');
    await auth.ensureFreshToken(); // cold obtain, token valid 15 min
    expect(obtainCalls).toBe(1);

    clock += 60_000; // 1 min later — token still valid
    await auth.ensureFreshToken();
    expect(obtainCalls).toBe(1);
    expect(refreshCalls).toBe(0); // no-op, no network

    clock += 15 * 60_000; // now past the 15-min access-token lifetime
    await auth.ensureFreshToken();
    expect(refreshCalls).toBe(1); // cheap refresh, not a full obtain
    expect(obtainCalls).toBe(1);
  });

  test('ensureFreshToken shares one in-flight auth between concurrent callers', async () => {
    __setPlatformClock(() => 0);
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: jwt(900), refresh: 'refresh-1' });
      }),
    );

    const auth = new ManagerAuth(testInstance.managerUrl, 'u', 'p');
    await Promise.all([auth.ensureFreshToken(), auth.ensureFreshToken()]);

    expect(obtainCalls).toBe(1);
  });
});

describe('createPlatform (memoized)', () => {
  beforeEach(() => __resetPlatformCache());

  test('reuses one Platform instance across calls for the same instance', async () => {
    __setPlatformClock(() => 0);
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: jwt(900), refresh: 'refresh-1' });
      }),
    );

    const p1 = await createPlatform(testInstance, 'test-user', 'test-pass');
    const p2 = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(p1).toBe(p2);
    // The expensive obtain runs once for the process, not once per request.
    expect(obtainCalls).toBe(1);
  });

  test('proactively refreshes an expired token before returning the cached platform', async () => {
    // The regression: the ixmp4 client's own 401-refresh is broken against this
    // server (it keys off `error_name`, the server sends `name`), so a reused
    // platform whose access token has expired would otherwise fail with
    // InvalidToken. createPlatform must refresh before handing the platform back.
    let clock = 0;
    __setPlatformClock(() => clock);
    let obtainCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        return HttpResponse.json({ access: jwt(clock / 1000 + 900), refresh: 'refresh-1' });
      }),
      http.post(REFRESH, () => {
        refreshCalls++;
        return HttpResponse.json({ access: jwt(clock / 1000 + 900) });
      }),
    );

    const p1 = await createPlatform(testInstance, 'test-user', 'test-pass');
    expect(obtainCalls).toBe(1);

    clock += 20 * 60_000; // 20 min later — the 15-min access token has expired
    const p2 = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(p2).toBe(p1); // same cached platform
    expect(refreshCalls).toBe(1); // refreshed, not re-obtained
    expect(obtainCalls).toBe(1);
  });

  test('does not cache a failed build, so the next call retries', async () => {
    __setPlatformClock(() => 0);
    let obtainCalls = 0;
    server.use(
      http.post(OBTAIN, () => {
        obtainCalls++;
        if (obtainCalls === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ access: jwt(900), refresh: 'refresh-1' });
      }),
    );

    await expect(createPlatform(testInstance, 'test-user', 'test-pass')).rejects.toThrow();
    const p = await createPlatform(testInstance, 'test-user', 'test-pass');

    expect(p).toBeDefined();
    expect(obtainCalls).toBe(2);
  });
});
