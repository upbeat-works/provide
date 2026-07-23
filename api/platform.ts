import { Platform, type IAuth } from '@iiasa/ixmp4-ts';
import { instances } from './instances';
import type { Ixmp4Instance } from './types';

// Refresh this long before the access token's `exp`, to cover clock skew and the
// latency of the request the token is about to authorize.
const TOKEN_SKEW_MS = 60_000;
// Assumed access-token lifetime when the JWT carries no readable `exp` (kept under
// the real ~15 min so we still refresh in time).
const FALLBACK_ACCESS_TTL_MS = 10 * 60 * 1000;

// Overridable clock so tests can drive token expiry deterministically.
let now: () => number = () => Date.now();
export function __setPlatformClock(fn: () => number): void {
  now = fn;
}
export function __resetPlatformClock(): void {
  now = () => Date.now();
}

/** Read the `exp` (ms) out of a JWT access token, or null if it has none. */
function parseJwtExpMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Auth for the IIASA Scenario Services Manager (Django SimpleJWT). `token/obtain`
// trades username+password for a short-lived `access` (~15 min) plus a long-lived
// `refresh` (~24 h), but costs ~2 s of server-side password hashing. `token/refresh`
// trades the refresh token for a fresh access token in ~150 ms, no hashing. We hold
// both so the expensive obtain runs at most once per refresh-token lifetime (or on a
// cold start / rejected refresh); every access-token expiry in between is a cheap
// refresh.
//
// We refresh PROACTIVELY (see ensureFreshToken) rather than relying on the ixmp4
// client's built-in 401 retry: that interceptor keys off `error_name === 'invalid_token'`,
// but this server sends the field as `name: 'InvalidToken'`, so it never fires and an
// expired token would surface as an unrecovered InvalidToken error.
export class ManagerAuth implements IAuth {
  accessToken: string | null = null;
  private refreshToken: string | null = null;
  private accessExpiresAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(
    private managerUrl: string,
    private username: string,
    private password: string,
  ) {}

  /**
   * Guarantee a non-expired access token before a request goes out. A no-op while
   * the current token is comfortably valid; otherwise refreshes/obtains. Concurrent
   * callers share the single in-flight auth so an expiry can't fan out into N calls.
   */
  ensureFreshToken(): Promise<void> {
    if (this.accessToken && now() < this.accessExpiresAt - TOKEN_SKEW_MS) return Promise.resolve();
    if (!this.inFlight) {
      this.inFlight = this.refreshOrObtainAccessToken().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  async refreshOrObtainAccessToken(): Promise<void> {
    if (this.refreshToken && (await this.tryRefresh())) return;
    await this.obtain();
  }

  private setAccessToken(token: string): void {
    this.accessToken = token;
    this.accessExpiresAt = parseJwtExpMs(token) ?? now() + FALLBACK_ACCESS_TTL_MS;
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
    this.setAccessToken(data.access);
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
    this.setAccessToken(data.access);
    this.refreshToken = data.refresh ?? null;
  }
}

const platformCache = new Map<string, Promise<{ platform: Platform; auth: ManagerAuth }>>();

function cacheKey(instance: Ixmp4Instance, username: string): string {
  return `${instance.slug}::${username}`;
}

async function buildPlatform(
  instance: Ixmp4Instance,
  username: string,
  password: string,
): Promise<{ platform: Platform; auth: ManagerAuth }> {
  const url = new URL(instance.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const auth = new ManagerAuth(instance.managerUrl, username, password);
  await auth.ensureFreshToken(); // initial obtain, so the first request carries a token
  const platform = await Platform.create({ name: instance.slug, baseUrl, auth });
  return { platform, auth };
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
  const { platform, auth } = await pending;
  // The platform is reused for the whole process, so its token outlives a single
  // request; refresh it before handing it back (the client's own 401 refresh is
  // broken against this server — see ManagerAuth).
  await auth.ensureFreshToken();
  return platform;
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
