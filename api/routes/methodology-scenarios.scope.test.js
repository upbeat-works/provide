import { beforeEach, describe, expect, it, vi } from 'vitest';
import { instances } from '../instances';
import { methodologyScenarios } from './methodology-scenarios';
import { fetchMethodologyScenarioDetails } from '../views/scenarios';

vi.mock('../views/scenarios', () => ({ fetchMethodologyScenarioDetails: vi.fn() }));

const env = { IXMP4_USERNAME: 'user', IXMP4_PASSWORD: 'password' };

beforeEach(() => vi.resetAllMocks());

describe('methodology scenarios source selection', () => {
  it('loads the selected source even when other sources are unavailable', async () => {
    fetchMethodologyScenarioDetails.mockImplementation(async (instance) => {
      if (instance.slug !== 'sparccle-internal') throw new Error('Unavailable');
      return [{ id: 'scenario', instance: instance.slug }];
    });
    const response = await methodologyScenarios.request('/?instance=sparccle-internal', {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 'scenario', instance: 'sparccle-internal' }]);
    expect(fetchMethodologyScenarioDetails).toHaveBeenCalledTimes(1);
    expect(fetchMethodologyScenarioDetails).toHaveBeenCalledWith(
      instances.find(({ slug }) => slug === 'sparccle-internal'),
      { username: 'user', password: 'password' }
    );
  });

  it('rejects an unknown source before requesting data', async () => {
    fetchMethodologyScenarioDetails.mockResolvedValue([]);
    const response = await methodologyScenarios.request('/?instance=unknown', {}, env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Unknown instance: unknown' });
    expect(fetchMethodologyScenarioDetails).not.toHaveBeenCalled();
  });

  it('loads all sources when no source is supplied', async () => {
    fetchMethodologyScenarioDetails.mockImplementation(async (instance) => [{ id: instance.slug }]);
    const response = await methodologyScenarios.request('/', {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(instances.map(({ slug }) => ({ id: slug })));
    expect(fetchMethodologyScenarioDetails).toHaveBeenCalledTimes(instances.length);
  });
});
