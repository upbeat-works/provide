import { Platform, type IAuth } from '@iiasa/ixmp4-ts';
import { instances } from './instances';
import type { Ixmp4Instance } from './types';

// Auth for the IIASA Scenario Services Manager (Django SimpleJWT). `token/obtain`
// trades username+password for a short-lived `access` (~15 min) plus a long-lived
// `refresh` (~24 h), but costs ~2 s of server-side password hashing. `token/refresh`
// trades the refresh token for a fresh access token in ~150 ms, no hashing. We hold
// both so the expensive obtain runs at most once per refresh-token lifetime (or on a
// cold start / rejected refresh); every access-token expiry in between is a cheap
// refresh. The ixmp4 client drives this lazily — it only calls
// refreshOrObtainAccessToken() when a request comes back 401 `invalid_token`.
export class ManagerAuth implements IAuth {
  accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(
    private managerUrl: string,
    private username: string,
    private password: string,
  ) {}

  async refreshOrObtainAccessToken(): Promise<void> {
    if (this.refreshToken && (await this.tryRefresh())) return;
    await this.obtain();
  }

  /** Cheap path: exchange the refresh token for a new access token (~150 ms). */
  private async tryRefresh(): Promise<boolean> {
    const res = await fetch(`${this.managerUrl}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: this.refreshToken }),
    });
    if (!res.ok) {
      // Refresh token expired/rejected — drop it and fall back to a full obtain.
      this.refreshToken = null;
      return false;
    }
    const data = (await res.json()) as { access: string; refresh?: string };
    this.accessToken = data.access;
    // SimpleJWT can be configured to rotate refresh tokens; keep the new one if sent.
    if (data.refresh) this.refreshToken = data.refresh;
    return true;
  }

  /** Expensive path: full username+password auth (~2 s of password hashing). */
  private async obtain(): Promise<void> {
    const res = await fetch(`${this.managerUrl}/token/obtain/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!res.ok) throw new Error(`ixmp4 auth → ${res.status}`);
    const data = (await res.json()) as { access: string; refresh?: string };
    this.accessToken = data.access;
    this.refreshToken = data.refresh ?? null;
  }
}

// One Platform per instance, reused across requests. The ixmp4 client is built for
// a single long-lived Platform whose IAuth it refreshes lazily on 401 — so the old
// per-request createPlatform needlessly re-ran the ~2 s obtain every time. Keyed by
// slug + username so a credential change starts a fresh platform. We cache the
// in-flight Promise (not the resolved Platform) so concurrent cold-start callers
// share one build, and a rejected build is evicted so the next call can retry.
const platformCache = new Map<string, Promise<Platform>>();

function cacheKey(instance: Ixmp4Instance, username: string): string {
  return `${instance.slug}::${username}`;
}

async function buildPlatform(
  instance: Ixmp4Instance,
  username: string,
  password: string,
): Promise<Platform> {
  const url = new URL(instance.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const auth = new ManagerAuth(instance.managerUrl, username, password);
  // Obtain eagerly so the first real request already carries a token (the client
  // would otherwise fire it unauthenticated, eat a 403, then retry). Runs once per
  // process now that the platform is cached, not once per request.
  await auth.refreshOrObtainAccessToken();
  return Platform.create({ name: instance.slug, baseUrl, auth });
}

export async function createPlatform(
  instance: Ixmp4Instance,
  username: string,
  password: string,
): Promise<Platform> {
  const key = cacheKey(instance, username);
  let pending = platformCache.get(key);
  if (!pending) {
    pending = buildPlatform(instance, username, password);
    // Don't cache a rejected build — evict so the next call retries a fresh obtain.
    pending.catch(() => {
      if (platformCache.get(key) === pending) platformCache.delete(key);
    });
    platformCache.set(key, pending);
  }
  return pending;
}

export async function createPlatforms(
  username: string,
  password: string,
): Promise<Array<{ instance: Ixmp4Instance; platform: Platform }>> {
  return Promise.all(
    instances.map(async (instance) => ({
      instance,
      platform: await createPlatform(instance, username, password),
    })),
  );
}

// Test seam: clears the memoized platforms so a test starts from a cold cache.
export function __resetPlatformCache(): void {
  platformCache.clear();
}
