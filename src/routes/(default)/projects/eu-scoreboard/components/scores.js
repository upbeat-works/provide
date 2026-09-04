// The scoreboard's scales, and the country values the maps and the ranking are
// drawn from. The values are PLACEHOLDERS — there are no scoreboard endpoints
// yet — but they live here rather than in each page so the choropleth, the
// legend and the leaderboard cannot disagree with one another. When the
// endpoints land, only this module is replaced.

// Composite risk score, 0–100. Classes ascending; the colours are the ones the
// ranking panel's ramp already used (they are not in color-tokens-light.json).
export const RISK_CLASSES = [
  { min: 0, label: 'Very Low', color: '#EEBF5E' },
  { min: 40, label: 'Low', color: '#E9974A' },
  { min: 60, label: 'Medium', color: '#C91C1C' },
  { min: 80, label: 'High', color: '#5A0F6B' },
];

// A single indicator (annual maximum temperature, °C) gets a sequential ramp
// rather than the risk scale's diverging one — it is a measured value, not a
// score, so there is no "bad end" to diverge from.
export const INDICATOR_CLASSES = [
  { min: 0, label: 'Very low', color: '#FBEADB' },
  { min: 28, label: 'Low', color: '#F2C192' },
  { min: 34, label: 'Med', color: '#E9974A' },
  { min: 40, label: 'High', color: '#8C5B2C' },
];

// Keyed on the legacy admin0 geo id the geo-shape features carry. Covers the
// EU-27, the EEA/EFTA states, the UK and the accession countries — the extent
// the scoreboard speaks for. Anything outside it (Russia, Türkiye, north
// Africa) is deliberately unscored and stays basemap. Malta and the
// microstates are absent from the admin0 shapes, so they cannot be drawn.
const EUROPE = [
  { uid: 'ESP', label: 'Spain', score: 92, maxTemp: 42 },
  { uid: 'GRC', label: 'Greece', score: 90, maxTemp: 42 },
  { uid: 'CYP', label: 'Cyprus', score: 89, maxTemp: 41 },
  { uid: 'ITA', label: 'Italy', score: 88, maxTemp: 40 },
  { uid: 'PRT', label: 'Portugal', score: 86, maxTemp: 41 },
  { uid: 'ALB', label: 'Albania', score: 79, maxTemp: 40 },
  { uid: 'MKD', label: 'North Macedonia', score: 78, maxTemp: 39 },
  { uid: 'FRA', label: 'France', score: 78, maxTemp: 40 },
  { uid: 'BGR', label: 'Bulgaria', score: 76, maxTemp: 39 },
  { uid: 'HRV', label: 'Croatia', score: 74, maxTemp: 38 },
  { uid: 'KOS', label: 'Kosovo', score: 74, maxTemp: 38 },
  { uid: 'SRB', label: 'Serbia', score: 73, maxTemp: 39 },
  { uid: 'ROU', label: 'Romania', score: 72, maxTemp: 38 },
  { uid: 'MNE', label: 'Montenegro', score: 72, maxTemp: 38 },
  { uid: 'HUN', label: 'Hungary', score: 71, maxTemp: 38 },
  { uid: 'BIH', label: 'Bosnia and Herzegovina', score: 70, maxTemp: 38 },
  { uid: 'MDA', label: 'Moldova', score: 70, maxTemp: 38 },
  { uid: 'SVN', label: 'Slovenia', score: 68, maxTemp: 36 },
  { uid: 'UKR', label: 'Ukraine', score: 66, maxTemp: 37 },
  { uid: 'SVK', label: 'Slovakia', score: 64, maxTemp: 36 },
  { uid: 'AUT', label: 'Austria', score: 62, maxTemp: 36 },
  { uid: 'CZE', label: 'Czechia', score: 60, maxTemp: 36 },
  { uid: 'DEU', label: 'Germany', score: 58, maxTemp: 36 },
  { uid: 'CHE', label: 'Switzerland', score: 57, maxTemp: 35 },
  { uid: 'POL', label: 'Poland', score: 55, maxTemp: 35 },
  { uid: 'LUX', label: 'Luxembourg', score: 54, maxTemp: 35 },
  { uid: 'BEL', label: 'Belgium', score: 52, maxTemp: 34 },
  { uid: 'NLD', label: 'Netherlands', score: 50, maxTemp: 34 },
  { uid: 'GBR', label: 'United Kingdom', score: 46, maxTemp: 33 },
  { uid: 'DNK', label: 'Denmark', score: 42, maxTemp: 32 },
  { uid: 'LTU', label: 'Lithuania', score: 40, maxTemp: 32 },
  { uid: 'LVA', label: 'Latvia', score: 36, maxTemp: 31 },
  { uid: 'SWE', label: 'Sweden', score: 35, maxTemp: 31 },
  { uid: 'IRL', label: 'Ireland', score: 34, maxTemp: 28 },
  { uid: 'EST', label: 'Estonia', score: 32, maxTemp: 30 },
  { uid: 'FIN', label: 'Finland', score: 30, maxTemp: 30 },
  { uid: 'NOR', label: 'Norway', score: 26, maxTemp: 30 },
  { uid: 'ISL', label: 'Iceland', score: 12, maxTemp: 22 },
];

// The two views map different quantities over the same countries, so each gets
// the `{ uid, label, value }` rows the choropleth join expects.
export const riskValues = EUROPE.map(({ uid, label, score }) => ({ uid, label, value: score }));
export const indicatorValues = EUROPE.map(({ uid, label, maxTemp }) => ({ uid, label, value: maxTemp }));

// A comparison puts two views of the same thing side by side, but there is only
// one set of placeholder values, so both sides would draw the identical map.
// This nudges them apart by a fixed amount per scenario and per year — enough to
// tell the two sides apart, and no kind of model: it goes when the endpoints
// land and each view fetches its own values.
// Callers hold the selection as option objects ({ uid, label }); the nudge only
// needs something stable to seed on.
const idOf = (value) => (value && typeof value === 'object' ? value.uid : value);
// FNV-1a with a final avalanche. A linear hash (a sum, or h*31+c) is not enough
// here: the country is mixed in after the scenario, so with a linear hash two
// scenarios whose hashes agree modulo the bucket count agree for *every*
// country, and the comparison draws the identical map on both sides — the one
// thing this exists to prevent. The xor-multiply breaks that.
function hash(seed) {
  let h = 2166136261;
  for (const character of String(seed)) {
    h = Math.imul(h ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

// Seeded per country as well as per scenario, so a comparison reorders the
// ranking and recolours the map rather than shifting every country by the same
// amount — which would have drawn two near-identical sides.
function offsetFor(view, uid) {
  const scenario = idOf(view?.scenario);
  const perScenario = scenario ? (hash(`${scenario}|${uid}`) % 61) / 10 - 3 : 0;
  return perScenario + (Number(idOf(view?.year) ?? 2025) - 2025) * 0.2;
}

function shift(values, view, { min = -Infinity, max = Infinity, decimals = 1 } = {}) {
  const step = 10 ** decimals;
  return values.map((entry) => {
    const offset = offsetFor(view, entry.uid);
    if (!offset) return entry;
    return { ...entry, value: Math.round(Math.min(max, Math.max(min, entry.value + offset)) * step) / step };
  });
}

export const indicatorValuesFor = (view) => shift(indicatorValues, view);

// Scores stay on their 0–100 scale however far a comparison nudges them.
export const riskValuesFor = (view) => shift(riskValues, view, { min: 0, max: 100, decimals: 0 });

// The leaderboard is the same data the map is coloured from, ranked — so
// comparing two scenarios reorders the ranking as well as recolouring the map.
export const riskRankingFor = (view) =>
  [...riskValuesFor(view)].sort((a, b) => b.value - a.value).map((entry, i) => ({ rank: i + 1, ...entry }));

// What the scoreboard has values for — the countries its filters may offer.
export const coveredGeoIds = EUROPE.map(({ uid }) => uid);
