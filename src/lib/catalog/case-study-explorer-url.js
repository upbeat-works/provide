export function safeCaseStudyExplorerUrl(href, indicatorIndex) {
  if (typeof href !== 'string') return undefined;
  const hasControlCharacter = /[\u0000-\u001f\u007f]/.test(href);
  if (!href.startsWith('/') || href.startsWith('//') || href !== href.trim() || hasControlCharacter) return undefined;
  let url;
  try {
    url = new URL(href, 'https://provide.local');
  } catch {
    return undefined;
  }
  if (url.origin !== 'https://provide.local') return undefined;
  if (url.pathname !== '/impacts/explore' && url.pathname !== '/impacts/avoid') return undefined;
  const indicatorId = url.searchParams.get('indicator');
  if (!indicatorId) return href;
  const instance = url.searchParams.get('instance');
  if (!instance) return undefined;
  const selectedSourceFailed = (indicatorIndex.failedInstances ?? []).some((failure) => failure.instance === instance);
  if (selectedSourceFailed) return undefined;
  const matches = (indicatorIndex.indicators ?? []).filter((indicator) => indicator.id === indicatorId && indicator.instance === instance);
  if (matches.length !== 1) return undefined;
  return href;
}
