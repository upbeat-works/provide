// Option lists for the scoreboard's filter bar that come from neither the
// catalog nor the scoreboard's own (not yet existing) endpoints.

// The years the scoreboard offers. A flat range for now — the real bounds will
// come from the data once there are endpoints to ask.
const FIRST_YEAR = 2012;
const LAST_YEAR = 2026;
export const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => {
  const year = FIRST_YEAR + i;
  return { uid: year, label: String(year) };
});

export const DEFAULT_YEAR = YEARS.find(({ uid }) => uid === 2025);
