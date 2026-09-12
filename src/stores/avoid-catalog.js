// Isolated canonical selection state for the avoid page.
import { derived, writable, get as getStore } from 'svelte/store';
import { page } from '$app/stores';
import { browser } from '$app/environment';
import { getLocalStorage, setLocalStorage } from './utils.js';
import { LOCALSTORE_GEOGRAPHY, LOCALSTORE_INDICATOR } from '$config';
import { avoidAvailableIndicators, avoidAllIndicatorParameters, reconcileAvoidParams, avoidSectors, reconcileSector } from '$lib/catalog/avoid-selection.js';
import { canonicalAvoidIndicatorUid, canonicalAvoidParameterValues } from '$lib/catalog/translate.js';

const AVOID_PREFIX = 'avoid-';

export const AVOID_META = derived(page, ($p) => $p.data?.avoidMeta ?? {});
export const AVOID_CITIES = derived(AVOID_META, ($m) => ($m.cities ?? []).map((city) => ({ ...city, id: city.label, uid: city.label, geoId: city.uid })));
export const AVOID_INDICATORS = derived(AVOID_META, ($m) =>
  ($m.indicators ?? [])
    .map((indicator) => {
      const id = canonicalAvoidIndicatorUid(indicator.uid);
      if (!id) return undefined;
      const parameters = {};
      for (const [key, values] of Object.entries(indicator.parameters ?? {})) {
        parameters[key] = values.map((value) => canonicalAvoidParameterValues({ [key]: value })[key]);
      }
      return { ...indicator, id, uid: id, instance: 'provide-internal', parameters };
    })
    .filter(Boolean)
);
export const AVOID_INDICATOR_PARAMETERS_ALL = derived(AVOID_META, ($m) =>
  ($m.indicatorParameters ?? []).map((parameter) => ({
    ...parameter,
    options: (parameter.options ?? []).map((option) => ({
      ...option,
      uid: canonicalAvoidParameterValues({ [parameter.uid]: option.uid })[parameter.uid],
    })),
  }))
);
export const AVOID_SCENARIOS = derived(AVOID_META, ($m) => $m.scenarios ?? []);
const AVOID_SECTORS_META = derived(AVOID_META, ($m) => $m.sectors ?? []);

// ---- Selection (persisted under an `avoid-` localStorage namespace) ----
export const AVOID_CITY_UID = writable(getLocalStorage(`${AVOID_PREFIX}${LOCALSTORE_GEOGRAPHY}`, undefined));
AVOID_CITY_UID.subscribe((v) => setLocalStorage(`${AVOID_PREFIX}${LOCALSTORE_GEOGRAPHY}`, v));

export const AVOID_INDICATOR_UID = writable(getLocalStorage(`${AVOID_PREFIX}${LOCALSTORE_INDICATOR}`, undefined));
AVOID_INDICATOR_UID.subscribe((v) => setLocalStorage(`${AVOID_PREFIX}${LOCALSTORE_INDICATOR}`, v));
export const AVOID_INSTANCE = writable(getLocalStorage(`${AVOID_PREFIX}instance`, undefined));
AVOID_INSTANCE.subscribe((v) => setLocalStorage(`${AVOID_PREFIX}instance`, v));

export const AVOID_PARAMS = writable(
  getLocalStorage(`${AVOID_PREFIX}params`, undefined, (v) => {
    if (!v || typeof v !== 'string') return {};
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  })
);
AVOID_PARAMS.subscribe((v) => setLocalStorage(`${AVOID_PREFIX}params`, JSON.stringify(v ?? {})));

// By Geography / By Indicator, mirroring the explore SELECTION_MODE.
export const AVOID_SELECTION_MODE = writable('geography');

// Active sector pill in the indicator picker.
export const AVOID_CURRENT_SECTOR = writable(undefined);

// ---- Derived selection ----
export const AVOID_GEOGRAPHY = derived([AVOID_CITY_UID, AVOID_CITIES], ([$uid, $cities]) => $cities.find((c) => c.uid === $uid));
export const AVOID_GEOGRAPHY_LABEL = derived(AVOID_GEOGRAPHY, ($g) => $g?.label);
export const AVOID_IS_EMPTY_GEOGRAPHY = derived(AVOID_GEOGRAPHY, ($g) => !$g);

export const AVOID_INDICATOR = derived([AVOID_INDICATOR_UID, AVOID_INSTANCE, AVOID_INDICATORS], ([$uid, $instance, $inds]) => {
  return $inds.find((item) => item.uid === $uid && item.instance === $instance);
});
export const AVOID_IS_EMPTY_INDICATOR = derived(AVOID_INDICATOR, ($i) => !$i);

export const AVOID_AVAILABLE_INDICATORS = derived([AVOID_INDICATORS, AVOID_GEOGRAPHY, AVOID_SELECTION_MODE], ([$inds, $city, $mode]) =>
  $mode === 'indicator' ? $inds : avoidAvailableIndicators($inds, $city?.geoId)
);
export const AVOID_AVAILABLE_CITIES = derived([AVOID_CITIES, AVOID_INDICATOR, AVOID_SELECTION_MODE], ([$cities, $ind, $mode]) => {
  if ($mode !== 'indicator' || !$ind) return $cities;
  const allowed = new Set($ind.availableGeographies ?? []);
  return $cities.filter((c) => allowed.has(c.geoId));
});

export const AVOID_IS_EMPTY = derived([AVOID_GEOGRAPHY, AVOID_INDICATOR], ([$g, $i]) => !$g || !$i);
export const AVOID_IS_AVAILABLE = derived([AVOID_INDICATOR, AVOID_GEOGRAPHY], ([$ind, $city]) => !!$ind && (!$city || ($ind.availableGeographies ?? []).includes($city.geoId)));

export const AVOID_SECTORS = derived([AVOID_AVAILABLE_INDICATORS, AVOID_SECTORS_META], ([$inds, $meta]) => avoidSectors($inds, $meta));

// Indicators shown in the list: available ones narrowed to the active sector pill.
export const AVOID_SECTOR_INDICATORS = derived([AVOID_AVAILABLE_INDICATORS, AVOID_CURRENT_SECTOR], ([$inds, $sector]) => (!$sector ? $inds : $inds.filter((i) => (i.sector ?? 'other') === $sector)));

// ---- Parameters ----
// ALL params for the indicator (defaulted + sent in every request); the visible
// subset is only those with a real choice.
export const AVOID_ALL_PARAMETERS = derived([AVOID_INDICATOR, AVOID_INDICATOR_PARAMETERS_ALL], ([$ind, $params]) => avoidAllIndicatorParameters($ind, $params));
export const AVOID_PARAMETERS = derived(AVOID_ALL_PARAMETERS, ($all) => $all.filter((p) => p.options.length > 1));

// Keep AVOID_PARAMS valid (all params defaulted) whenever the indicator changes.
export function syncAvoidParams() {
  const params = getStore(AVOID_ALL_PARAMETERS);
  AVOID_PARAMS.update((prev) => reconcileAvoidParams(params, prev));
}

// Default/reconcile params as soon as the indicator resolves — including the
// initial (restored-from-localStorage) selection — so the first chart request
// carries its params instead of firing once with an empty set. Also keep the
// active sector pill valid when the available sectors change (e.g. switching to
// a city whose indicators no longer include the selected sector).
if (browser) {
  AVOID_INDICATOR.subscribe(() => syncAvoidParams());
  AVOID_SECTORS.subscribe(($sectors) => {
    const reconciled = reconcileSector(getStore(AVOID_CURRENT_SECTOR), $sectors);
    if (reconciled !== getStore(AVOID_CURRENT_SECTOR)) AVOID_CURRENT_SECTOR.set(reconciled);
  });
}

// The selected param VALUES resolved to their full option objects (for label
// text like the reference period). Mirrors the shared CURRENT_INDICATOR_OPTIONS.
export const AVOID_CURRENT_OPTIONS = derived([AVOID_PARAMS, AVOID_ALL_PARAMETERS], ([$values, $params]) => {
  const out = {};
  for (const p of $params) out[p.uid] = p.options.find((o) => o.uid === $values[p.uid]);
  return out;
});

// Indicator label with the X°C placeholder replaced by the selected
// indicator_value option, mirroring the shared CURRENT_INDICATOR_LABEL.
export const AVOID_INDICATOR_LABEL = derived([AVOID_INDICATOR, AVOID_CURRENT_OPTIONS], ([$ind, $options]) => {
  let labelWithinSentence = $ind?.labelWithinSentence ?? $ind?.label;
  let label = $ind?.label;
  const valueLabel = $options?.indicator_value?.label;
  if (valueLabel && $ind?.parameters?.indicator_value?.length) {
    labelWithinSentence = labelWithinSentence?.replace(/X°C/, valueLabel);
    label = label?.replace(/X°C/, valueLabel);
  }
  return { labelWithinSentence, label };
});

export const AVOID_TEMPLATE_PROPS = derived([AVOID_GEOGRAPHY, AVOID_INDICATOR, AVOID_CURRENT_OPTIONS, AVOID_INDICATOR_LABEL], ([$geo, $ind, $options, $label]) => ({
  geography: $geo,
  indicator: $ind,
  indicatorOptions: $options,
  indicatorUnit: $ind?.unit,
  indicatorLabel: $label,
}));
