// A comparison lifts one dimension out of the filter bar and gives each map its
// own value for it; everything else stays shared. Both scoreboard views work
// this way, over different dimensions, so the rules live here.

// Entering a comparison, or switching which dimension it compares, seeds the two
// maps: the left keeps what the filter bar had, the right takes the next option
// along — so a comparison never opens as the same map twice. A `current` that is
// not in the list (or absent, e.g. "all countries") lands on the first option.
export function seedComparison(options = [], current) {
  if (!options.length) return [current, current];
  const index = options.findIndex(({ uid }) => uid === current?.uid);
  return [current, options[(index + 1) % options.length]];
}

// What each side draws: the shared selection, with the compared dimension taken
// from that side. One view, unchanged, when not comparing.
export function comparisonViews(compareBy, sides = [], shared = {}) {
  if (!compareBy) return [shared];
  return sides.map((value) => ({ ...shared, [compareBy]: value }));
}
