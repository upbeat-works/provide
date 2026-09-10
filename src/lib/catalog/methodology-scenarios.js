import { MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';

export function methodologyScenarioKey(scenario) {
  return `methodology-scenario-${encodeURIComponent(scenario.instance)}:${encodeURIComponent(scenario.id ?? scenario.uid)}`;
}

export function methodologyScenarioIds(scenarios, selectedKeys) {
  const idsByKey = new Map(scenarios.map((scenario) => [methodologyScenarioKey(scenario), scenario.id ?? scenario.uid]));
  return selectedKeys.map((key) => idsByKey.get(key)).filter((id) => id !== undefined);
}

export function methodologyScenarioSelectionKeys(scenarios, candidateKeys) {
  const known = new Set(scenarios.map(methodologyScenarioKey));
  const selected = [];
  for (const key of candidateKeys) {
    if (!known.has(key) || selected.includes(key)) continue;
    selected.push(key);
    if (selected.length === MAX_NUMBER_SELECTABLE_SCENARIOS) break;
  }
  return selected;
}

export function methodologyExplorerScenarioIds(scenarios, selectedKeys) {
  return [...new Set(methodologyScenarioIds(scenarios, selectedKeys))];
}

export function methodologyScenarioKeys(scenarios, selectedIds) {
  const selected = new Set(selectedIds);
  const keys = scenarios.filter((scenario) => selected.has(scenario.id ?? scenario.uid)).map(methodologyScenarioKey);
  return methodologyScenarioSelectionKeys(scenarios, keys);
}
