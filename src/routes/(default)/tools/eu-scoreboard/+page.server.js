import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';

// Placeholder loader: the scoreboard has no endpoints yet, so nothing is
// fetched here. When they land, this is where the geography/indicator/scenario
// slices get loaded (see the loaders in $lib/utils/apis.js).
export const load = async () => {
  return {
    title: generatePageTitle(LABEL_EU_SCOREBOARD),
  };
};
