import { generatePageTitle } from '$utils/meta.js';
import { LABEL_EU_SCOREBOARD } from '$config';

// The ranking view is the scoreboard's root, so it carries the plain title.
// Nothing else is fetched: the scoreboard's own data has no endpoints yet, and
// this is where the geography/indicator/scenario slices get loaded when they land.
export const load = () => ({
  title: generatePageTitle(LABEL_EU_SCOREBOARD),
});
