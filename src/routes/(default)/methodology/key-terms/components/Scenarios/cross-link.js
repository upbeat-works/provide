export function methodologyExplorerParams(selectedScenarios, instance) {
  const params = { scenarios: [...selectedScenarios] };
  if (instance) params.instance = instance;
  return params;
}
