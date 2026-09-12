import { describe, expect, test } from 'vitest';
import { methodologyExplorerScenarioIds, methodologyScenarioIds, methodologyScenarioKey, methodologyScenarioKeys, methodologyScenarioSelectionKeys } from './methodology-scenarios.js';

const scenarios = [
  { id: 'Shared / 2', uid: 'Shared / 2', label: 'Shared label', instance: 'primary source' },
  { id: 'Shared / 2', uid: 'Shared / 2', label: 'Shared label', instance: 'secondary' },
];

describe('methodology scenario identity', () => {
  test('keeps equal scenario IDs from different sources independent', () => {
    const keys = scenarios.map(methodologyScenarioKey);

    expect(keys).toEqual(['methodology-scenario-primary%20source:Shared%20%2F%202', 'methodology-scenario-secondary:Shared%20%2F%202']);
    expect(new Set(keys).size).toBe(2);
    expect(methodologyScenarioIds(scenarios, [keys[1]])).toEqual(['Shared / 2']);
  });

  test('limits manual source-bound row selection without merging equal IDs', () => {
    const rows = [...scenarios, { id: 'Second', uid: 'Second', instance: 'primary' }, { id: 'Third', uid: 'Third', instance: 'primary' }];
    const candidateKeys = rows.map(methodologyScenarioKey);
    const keys = methodologyScenarioSelectionKeys(rows, candidateKeys);

    expect(keys).toEqual(candidateKeys.slice(0, 3));
    expect(methodologyScenarioIds(rows, keys)).toEqual(['Shared / 2', 'Shared / 2', 'Second']);
  });

  test('limits an ID-only preset after expanding equal IDs to source-bound rows', () => {
    const rows = [...scenarios, { id: 'Second', uid: 'Second', instance: 'primary' }, { id: 'Third', uid: 'Third', instance: 'primary' }];
    const keys = methodologyScenarioKeys(rows, ['Shared / 2', 'Second', 'Third']);

    expect(keys).toEqual(rows.map(methodologyScenarioKey).slice(0, 3));
    expect(methodologyScenarioIds(rows, keys)).toEqual(['Shared / 2', 'Shared / 2', 'Second']);
  });

  test('deduplicates raw IDs only for the outbound Explorer link', () => {
    const keys = scenarios.map(methodologyScenarioKey);

    expect(methodologyScenarioIds(scenarios, keys)).toEqual(['Shared / 2', 'Shared / 2']);
    expect(methodologyExplorerScenarioIds(scenarios, keys)).toEqual(['Shared / 2']);
  });
});
