export function sendLegacyAvoidRequest(fetcher, store, endpoint, legacyParams, extraParams = {}) {
  if (!legacyParams?.geography || !legacyParams?.indicator) return undefined;
  return fetcher(store, { endpoint, params: { ...legacyParams, ...extraParams } });
}
