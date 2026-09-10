import { get } from 'svelte/store';

export async function loadEmbedRuntime(flow) {
  await Promise.all([flow.catalog.loadIndicatorIndex(), flow.catalog.loadGeographyIndex()]);
  const indexRequest = get(flow.catalog.indicatorIndex);
  const indicator = get(flow.catalog.selection).indicator;
  if (!indicator || indexRequest.status !== 'success') return;
  const selectedSourceFailed = (indexRequest.data.failedInstances ?? []).some(({ instance }) => instance === indicator.instance);
  if (selectedSourceFailed) return;
  const confirmed = (indexRequest.data.indicators ?? []).some(({ id, instance }) => id === indicator.id && instance === indicator.instance);
  if (!confirmed) return;
  await flow.chooseIndicator(indicator);
}
