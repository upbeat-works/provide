// Live-chart blocks in case studies render one of the site's own /embed/ pages
// in a same-origin iframe. Editors usually copy the link from a chart's menu, so
// an absolute URL from any PROVIDE host (local, staging, production) is accepted
// and reduced to its path: the chart always loads from the site serving the page.
export const CASE_STUDY_EMBEDS = ['impact-time', 'impact-geo', 'unavoidable-risk', 'eu-scoreboard-chart'];

const BASE = 'https://provide.local';

export function safeCaseStudyEmbedUrl(href) {
  if (typeof href !== 'string') return undefined;
  const value = href.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith('//')) return undefined;
  const isRelative = value.startsWith('/');
  if (!isRelative && !/^https?:\/\//i.test(value)) return undefined;

  let url;
  try {
    url = new URL(value, BASE);
  } catch {
    return undefined;
  }
  const match = url.pathname.match(/^\/embed\/([^/]+)\/?$/);
  if (!match || !CASE_STUDY_EMBEDS.includes(match[1])) return undefined;

  // `inline` drops the embed page's own logo footer: the chart sits inside a PROVIDE page.
  url.searchParams.set('inline', 'true');
  return `/embed/${match[1]}${url.search}`;
}
