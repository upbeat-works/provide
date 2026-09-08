// The series the indicator charts are drawn from. Like `scores.js` these values
// are PLACEHOLDERS — there are no scoreboard endpoints yet — but the shapes are
// the ones the chart contracts describe, so when the endpoints land only this
// module is replaced:
//
//   line / line with percentile range  `[{ uid, label, color, dash, values: [{ year, value, min, max }] }]`
//   stacked bar                        `[{ uid, label, values: [{ start, end, color, name }] }]`
//   trade-off scatter                  `[{ uid, label, x, y, size, risk }]`
//
// Colours come from the design tokens rather than from hex literals so the
// charts stay on the same palette as the rest of the site.
import tokens from '$styles/color-tokens-light.json';

const YEARS = [2020, 2030, 2040, 2050, 2060, 2070, 2080];

const toValues = (values) => YEARS.map((year, i) => ({ year, value: values[i] }));

// A scenario's line style. The three pathways are one ramp of the theme colour
// rather than three hues: they are ordered, so the darker line is the higher
// pathway, and the dash tells them apart where the ramp is faint.
const PATHWAYS = [
  { key: 'high', uid: 'ssp5-85', label: 'SSP5-8.5 (high)', color: tokens.theme['800'] },
  { key: 'mid', uid: 'ssp2-45', label: 'SSP2-4.5 (mid)', color: tokens.theme['500'], dash: '7 4' },
  { key: 'low', uid: 'ssp1-26', label: 'SSP1-2.6 (low)', color: tokens.theme['300'], dash: '3 4' },
];

export const BAND_LABEL = 'SSP5 uncertainty band';
const BAND_COLOR = tokens.theme['300'];
// The band is drawn at a fraction of its colour (MultipleAreaLayer), so the
// legend's solid swatch has to name the tint that ends up on screen rather than
// the fill it was made from.
const BAND_SWATCH = tokens.theme['100'];

// The percentile-range dependency: lower/central/upper for one scenario. Only
// the high pathway carries a band, which is what the source charts show —
// three bands over one another read as mud.
function pathwaySeries({ high, mid, low, spread }) {
  const values = { high, mid, low };
  return PATHWAYS.map(({ key, dash, ...pathway }) => ({
    ...pathway,
    dash,
    range: BAND_COLOR,
    isSelected: key === 'high',
    values: toValues(values[key]).map((d, i) => (key === 'high' && spread ? { ...d, min: d.value - spread[i], max: d.value + spread[i] } : d)),
  }));
}

// The legend a banded scenario chart carries: the band first, as the source
// charts do, then one entry per line.
export const pathwayLegend = (series) => [{ uid: 'band', label: BAND_LABEL, color: BAND_SWATCH, variant: 'block' }, ...seriesLegend(series)];

// Lines are named by their stroke, not by a block of colour.
export const seriesLegend = (series) => series.map(({ uid, label, color, dash }) => ({ uid, label, color, dash, variant: 'line' }));

export const meanTemperature = pathwaySeries({
  high: [0.8, 1.31, 1.78, 2.28, 2.77, 3.2, 3.6],
  mid: [0.8, 1.05, 1.4, 1.69, 1.95, 2.21, 2.42],
  low: [0.8, 0.95, 1.1, 1.31, 1.45, 1.54, 1.6],
  spread: [0.08, 0.36, 0.6, 0.8, 0.95, 1.05, 1.1],
});

export const maximumTemperature = pathwaySeries({
  high: [1.1, 1.72, 2.34, 2.96, 3.55, 4.1, 4.6],
  mid: [1.1, 1.42, 1.83, 2.2, 2.5, 2.76, 2.98],
  low: [1.1, 1.28, 1.46, 1.66, 1.79, 1.86, 1.9],
  spread: [0.1, 0.45, 0.75, 1.0, 1.2, 1.35, 1.45],
});

// Heatwaves lived through by someone born today — a count, so it starts at
// roughly nothing and the pathways fan out hard.
export const lifetimeExposure = pathwaySeries({
  high: [4, 7, 11, 16, 21, 26, 31],
  mid: [4, 6, 8, 11, 13, 15, 17],
  low: [4, 5, 6, 7, 8, 8.5, 9],
  spread: [0.5, 1.6, 2.8, 4, 5, 5.8, 6.4],
});

// The country comparison charts run on the categorical palette: the countries
// are not ordered, so a ramp would imply a ranking that isn't there.
const COUNTRIES = [
  { uid: 'ESP', label: 'Spain', color: tokens.theme['600'] },
  { uid: 'GRC', label: 'Greece', color: tokens.orange['500'], dash: '7 4' },
  { uid: 'ITA', label: 'Italy', color: tokens.grass['600'], dash: '4 3' },
  { uid: 'PRT', label: 'Portugal', color: tokens.gold['600'], dash: '9 4' },
  { uid: 'FRA', label: 'France', color: tokens.pink['700'], dash: '2 3' },
];

const countrySeries = (byCountry) => COUNTRIES.map((country) => ({ ...country, values: toValues(byCountry[country.uid]) }));

export const heatRelatedFacilities = countrySeries({
  ESP: [64, 68, 72, 76, 80, 83, 86],
  GRC: [63, 66, 70, 74, 76, 80, 83],
  ITA: [61, 65, 69, 73, 76, 79, 82],
  PRT: [58, 62, 66, 69, 73, 76, 79],
  FRA: [52, 55, 59, 63, 66, 69, 72],
});

export const economicDamages = countrySeries({
  ESP: [1.2, 1.9, 2.7, 3.6, 4.6, 5.5, 6.4],
  GRC: [0.8, 1.3, 1.9, 2.6, 3.3, 4.0, 4.6],
  ITA: [1.5, 2.2, 3.1, 4.1, 5.1, 6.0, 6.9],
  PRT: [0.5, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8],
  FRA: [1.1, 1.6, 2.3, 3.0, 3.8, 4.5, 5.2],
});

// Stacked bars are given as cumulative totals per pathway — that is how the
// quantity is actually reported ("people exposed under SSP2-4.5", not "the
// extra people SSP2-4.5 adds") — and stacked into segments below.
// `label` names the layer in the legend, where it has to say what the segment
// adds; `scenario` names the pathway on its own, for a tooltip that reads as a
// sentence.
export const EXPOSURE_LAYERS = [
  { uid: 'ssp1-26', label: 'Base · SSP1-2.6', scenario: 'SSP1-2.6', color: tokens.theme['100'] },
  { uid: 'ssp2-45', label: '+ up to SSP2-4.5', scenario: 'SSP2-4.5', color: tokens.theme['500'] },
  { uid: 'ssp5-85', label: '+ up to SSP5-8.5', scenario: 'SSP5-8.5', color: tokens.theme['800'] },
];

const POPULATION_EXPOSED = [
  { uid: 'AT13', label: 'Vienna', totals: [1.4, 1.85, 3.6] },
  { uid: 'AT11', label: 'Burgenland', totals: [1.32, 1.74, 3.4] },
  { uid: 'AT12', label: 'Lower Austria', totals: [1.28, 1.68, 3.3] },
  { uid: 'AT31', label: 'Upper Austria', totals: [1.22, 1.6, 3.15] },
  { uid: 'AT22', label: 'Styria', totals: [1.2, 1.56, 3.1] },
  { uid: 'AT21', label: 'Carinthia', totals: [1.12, 1.47, 2.95] },
  { uid: 'AT32', label: 'Salzburg', totals: [1.1, 1.44, 2.9] },
  { uid: 'AT34', label: 'Vorarlberg', totals: [1.05, 1.37, 2.75] },
  { uid: 'AT33', label: 'Tyrol', totals: [0.92, 1.2, 2.25] },
];

// Cumulative totals -> the segments a stacked bar is drawn from: each layer
// picks up where the one below it stopped, so the bar's full length is the
// highest pathway's total rather than the sum of all three. A layer that adds
// nothing (or that the row has no value for) contributes no segment, so it
// cannot draw a zero-width sliver of colour.
export function stackCumulative(rows = [], layers = []) {
  return rows.map(({ totals = [], ...row }) => {
    let start = 0;
    const values = layers.flatMap(({ label, ...layer }, i) => {
      const total = totals[i];
      if (!Number.isFinite(total) || total <= start) return [];
      // `name` rather than `label`: the segment is drawn inside a row that has a
      // label of its own, and a bar's tooltip needs to name both.
      const segment = { ...layer, name: label, start, end: total };
      start = total;
      return [segment];
    });
    return { ...row, values, total: start };
  });
}

export const populationExposed = stackCumulative(POPULATION_EXPOSED, EXPOSURE_LAYERS);

// The scatter's third channel: today's risk class, which is what the fill says.
// Same idea as the map's classes in `scores.js`, on the theme ramp the charts
// use rather than the map's.
export const RISK_LEVELS = [
  { uid: 'low', label: 'Low current risk', color: tokens.theme['100'] },
  { uid: 'medium', label: 'Medium current risk', color: tokens.theme['500'] },
  { uid: 'high', label: 'High current risk', color: tokens.theme['800'] },
];

// x: heat stress score today. y: how fast that score is growing. size: the
// population living with it — the trade-off is only legible with all three.
export const adaptationInvestments = [
  { uid: 'ESP', label: 'Spain', x: 87, y: 0.38, size: 48, risk: 'high' },
  { uid: 'ITA', label: 'Italy', x: 84, y: 0.35, size: 59, risk: 'high' },
  { uid: 'GRC', label: 'Greece', x: 80, y: 0.32, size: 11, risk: 'high' },
  { uid: 'PRT', label: 'Portugal', x: 77, y: 0.3, size: 10, risk: 'high' },
  { uid: 'FRA', label: 'France', x: 74, y: 0.34, size: 68, risk: 'high' },
  { uid: 'ROU', label: 'Romania', x: 61, y: 0.36, size: 19, risk: 'medium' },
  { uid: 'HRV', label: 'Croatia', x: 62, y: 0.28, size: 4, risk: 'medium' },
  { uid: 'AUT', label: 'Austria', x: 62, y: 0.24, size: 9, risk: 'medium' },
  { uid: 'BGR', label: 'Bulgaria', x: 58, y: 0.34, size: 7, risk: 'medium' },
  { uid: 'HUN', label: 'Hungary', x: 55, y: 0.3, size: 10, risk: 'medium' },
  { uid: 'CZE', label: 'Czechia', x: 48, y: 0.26, size: 11, risk: 'medium' },
  { uid: 'POL', label: 'Poland', x: 44, y: 0.21, size: 38, risk: 'low' },
  // The two big low-risk points sit almost on top of one another; Germany's name
  // goes to the left so the pair doesn't write into the same space.
  { uid: 'DEU', label: 'Germany', x: 38, y: 0.21, size: 83, risk: 'low', labelSide: 'left' },
  { uid: 'NLD', label: 'Netherlands', x: 30, y: 0.18, size: 18, risk: 'low' },
  { uid: 'BEL', label: 'Belgium', x: 28, y: 0.17, size: 12, risk: 'low' },
  { uid: 'DNK', label: 'Denmark', x: 20, y: 0.14, size: 6, risk: 'low' },
  { uid: 'SWE', label: 'Sweden', x: 15, y: 0.11, size: 10, risk: 'low' },
  { uid: 'FIN', label: 'Finland', x: 10, y: 0.09, size: 6, risk: 'low' },
];

// Where the scatter's reference lines sit — the middle of the score range, and
// the growth rate the countries above it are pulling away at.
export const ADAPTATION_REFERENCE = { x: 55, y: 0.25 };
