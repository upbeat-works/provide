import { URL_PATH_GEOGRAPHY, URL_PATH_INDICATOR, URL_PATH_SCENARIOS } from '$config';

export function selectionUrlParams(selection) {
  const params = {
    [URL_PATH_GEOGRAPHY]: selection.geography,
    [URL_PATH_SCENARIOS]: [...selection.scenarios],
    ...selection.parameters,
  };
  if (selection.indicator) {
    params[URL_PATH_INDICATOR] = selection.indicator.id;
    params.instance = selection.indicator.instance;
  }
  return params;
}
