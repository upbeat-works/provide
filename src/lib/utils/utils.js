import _, { kebabCase, uniq } from 'lodash-es';
import { extractEndYear } from '$utils/meta.js';
import { formatValue } from '$utils/formatting';

// Case-insensitive name matching helpers live in the dependency-free leaf module
// ./case-insensitive.js (avoids an import cycle with meta.js); re-exported here
// alongside the other scenario/list utilities.
import { ciKeyBy, ciGet, ciEquals } from './case-insensitive.js';
export { ciKeyBy, ciGet, ciEquals };

/**
 * Graft each selected scenario's data-driven endYear (its timeframe) from the
 * availability-derived `selectable` list, matched case-insensitively by uid.
 * The bare scenario list (CURRENT_SCENARIOS) carries no endYear — it lives only
 * on SELECTABLE_SCENARIOS — so charts that filter years by timeframe need it
 * grafted on. An endYear already present on a selected scenario is preserved.
 */
export function withScenarioTimeframe(selected, selectable, key = 'endYear') {
  const byUid = ciKeyBy(selectable);
  return selected.map((scenario) => ({
    ...scenario,
    [key]: scenario[key] ?? ciGet(byUid, scenario.uid)?.[key],
  }));
}

export const formatReadableList = function (arr, key) {
  const segments = formatObjArr(arr, key);
  return segments.map((s) => (s.type === 'element' ? s.value[key] : s.value)).join('');
};

export const formatObjArr = function (arr, key) {
  const formatter = new Intl.ListFormat('en-GB', {
    style: 'long',
    type: 'conjunction',
  });
  // We have to do an two extra steps because the formatToParts function does not allow object but requires strings
  // First, we map a string from each object
  // Second, we use the find function to bring back the object
  const list = formatter.formatToParts(arr.map((d) => d[key]));
  return list.map((obj) => {
    return {
      ...obj,
      value: obj.type === 'literal' ? obj.value : arr.find((d) => d[key] === obj.value),
    };
  });
};

export const formatList = function (_arr = []) {
  const arr = _arr.filter(Boolean);
  if (arr.length === 0) {
    return '';
  }
  const formatter = new Intl.ListFormat('en-GB', {
    style: 'long',
    type: 'conjunction',
  });
  const list = uniq(arr.map((d) => String(d)));
  return {
    label: formatter.format(list),
    length: list.length,
  };
};

export function extractEndYearFromScenarios(available, selectable) {
  const valid = uniq(selectable.map((s) => s.endYear));

  return _(available)
    .map((s) => extractEndYear(s))
    // Drop scenarios with no end year (no data for this selection) so they don't
    // produce a junk timeframe pill.
    .filter(Boolean)
    .uniq()
    .sort()
    .map((uid) => ({ uid: parseInt(uid), label: uid, disabled: !valid.includes(uid) }))
    .value();
}

export function slugify(name) {
  return kebabCase(
    name
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ô|ö|ò|ó/g, 'o')
      .replace(/è|é|ë/g, 'e')
      .replace(/ü/g, 'u')
      .replace(/ï|ì|í/g, 'i')
      .replace(/\W+/g, '-')
      .replace(/^\W|\W$/g, '')
  );
}

export function getMarginLeft(valueMax, unit, minMargin = 40) {
  const str = String(formatValue(valueMax, unit));
  return Math.max(str.length * 8, minMargin);
}

// Returns the largest availalbe image url based on the specified size
// Valid sizes are the ones provided by strapi/cloudinary (large, medium, small, thumbnail)
export const getStrapiImageAtSize = (image) => {
  const { hash, url } = image;
  const regex = /(https:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload)/;

  const match = url.match(regex);
  const extractedUrl = match ? match[0] : '';
  const newURL = extractedUrl + '/f_auto,q_auto/' + hash;

  return newURL;
};
