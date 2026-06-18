import { Platform, type IAuth } from '@iiasa/ixmp4-ts';
import { instances } from './instances';
import type { Ixmp4Instance } from './types';

class ManagerAuth implements IAuth {
  accessToken: string | null = null;

  constructor(
    private managerUrl: string,
    private username: string,
    private password: string,
  ) {}

  async refreshOrObtainAccessToken(): Promise<void> {
    const res = await fetch(`${this.managerUrl}/token/obtain/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!res.ok) throw new Error(`ixmp4 auth → ${res.status}`);
    const data = (await res.json()) as { access: string };
    this.accessToken = data.access;
  }
}

export async function createPlatform(
  instance: Ixmp4Instance,
  username: string,
  password: string,
): Promise<Platform> {
  const url = new URL(instance.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const auth = new ManagerAuth(instance.managerUrl, username, password);
  await auth.refreshOrObtainAccessToken();
  return Platform.create({ name: instance.slug, baseUrl, auth });
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
