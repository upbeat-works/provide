// The overview's mock scores drive both its map and ranking.

// Composite risk score, 0–100. Classes ascending; the colours are the ones the
// ranking panel's ramp already used (they are not in color-tokens-light.json).
export const RISK_CLASSES = [
  { min: 0, label: 'Very Low', color: '#FBD95A' },
  { min: 40, label: 'Low', color: '#F2AF4B' },
  { min: 60, label: 'Medium', color: '#DC6360' },
  { min: 80, label: 'High', color: '#8A55BF' },
];

// Keyed on the alpha-3 geo id the NUTS country features carry. Covers the
// EU-27, the EEA/EFTA states, the UK and the accession countries — the extent
// the scoreboard speaks for. Anything outside it (Russia, Türkiye, north
// Africa) is deliberately unscored and stays basemap. Moldova is scored but
// cannot be drawn: it is outside NUTS, so the country map has no shape for it.
const EUROPE = [
  { uid: 'ESP', label: 'Spain', score: 92 },
  { uid: 'GRC', label: 'Greece', score: 90 },
  { uid: 'CYP', label: 'Cyprus', score: 89 },
  { uid: 'ITA', label: 'Italy', score: 88 },
  { uid: 'PRT', label: 'Portugal', score: 86 },
  { uid: 'ALB', label: 'Albania', score: 79 },
  { uid: 'MKD', label: 'North Macedonia', score: 78 },
  { uid: 'FRA', label: 'France', score: 78 },
  { uid: 'BGR', label: 'Bulgaria', score: 76 },
  { uid: 'HRV', label: 'Croatia', score: 74 },
  { uid: 'KOS', label: 'Kosovo', score: 74 },
  { uid: 'SRB', label: 'Serbia', score: 73 },
  { uid: 'ROU', label: 'Romania', score: 72 },
  { uid: 'MNE', label: 'Montenegro', score: 72 },
  { uid: 'HUN', label: 'Hungary', score: 71 },
  { uid: 'BIH', label: 'Bosnia and Herzegovina', score: 70 },
  { uid: 'MDA', label: 'Moldova', score: 70 },
  { uid: 'SVN', label: 'Slovenia', score: 68 },
  { uid: 'UKR', label: 'Ukraine', score: 66 },
  { uid: 'SVK', label: 'Slovakia', score: 64 },
  { uid: 'AUT', label: 'Austria', score: 62 },
  { uid: 'CZE', label: 'Czechia', score: 60 },
  { uid: 'DEU', label: 'Germany', score: 58 },
  { uid: 'CHE', label: 'Switzerland', score: 57 },
  { uid: 'POL', label: 'Poland', score: 55 },
  { uid: 'LUX', label: 'Luxembourg', score: 54 },
  { uid: 'BEL', label: 'Belgium', score: 52 },
  { uid: 'NLD', label: 'Netherlands', score: 50 },
  { uid: 'GBR', label: 'United Kingdom', score: 46 },
  { uid: 'DNK', label: 'Denmark', score: 42 },
  { uid: 'LTU', label: 'Lithuania', score: 40 },
  { uid: 'LVA', label: 'Latvia', score: 36 },
  { uid: 'SWE', label: 'Sweden', score: 35 },
  { uid: 'IRL', label: 'Ireland', score: 34 },
  { uid: 'EST', label: 'Estonia', score: 32 },
  { uid: 'FIN', label: 'Finland', score: 30 },
  { uid: 'NOR', label: 'Norway', score: 26 },
  { uid: 'ISL', label: 'Iceland', score: 12 },
];

// The overview choropleth joins these values to the country boundaries.
export const riskValues = EUROPE.map(({ uid, label, score }) => ({ uid, label, value: score }));

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

// Scores stay on their 0–100 scale however far a comparison nudges them.
export const riskValuesFor = (view) => shift(riskValues, view, { min: 0, max: 100, decimals: 0 });

// The leaderboard is the same data the map is coloured from, ranked — so
// comparing two scenarios reorders the ranking as well as recolouring the map.
export const riskRankingFor = (view) =>
  [...riskValuesFor(view)].sort((a, b) => b.value - a.value).map((entry, i) => ({ rank: i + 1, ...entry }));
