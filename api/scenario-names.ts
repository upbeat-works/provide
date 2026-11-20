import type { Platform } from '@iiasa/ixmp4-ts';

export async function canonicalScenarioNames(platform: Platform, requested: string[]): Promise<string[]> {
  const names = await Promise.all(
    [...new Set(requested)].map(async (name) => {
      const matches = await platform.scenarios.list({ name_ilike: name });
      const exact = matches.map((scenario) => scenario.name).filter((candidate) => candidate.toLowerCase() === name.toLowerCase());
      return exact.length ? exact : [name];
    })
  );
  return [...new Set(names.flat())];
}
