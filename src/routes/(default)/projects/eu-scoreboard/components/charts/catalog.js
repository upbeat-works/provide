// Every chart on the indicators view: the copy its section is written from, the
// component that draws it, and what its caption row offers. It lives here
// rather than in the page because the embed route renders one of these charts
// on its own — that is what the "Download graph" screenshot is taken of, so the
// page and the embed have to be looking at the same list.
import LineChart from './LineChart.svelte';
import StackedBarChart from './StackedBarChart.svelte';
import BubbleChart from './BubbleChart.svelte';
import {
  ADAPTATION_REFERENCE,
  EXPOSURE_LAYERS,
  RISK_LEVELS,
  adaptationInvestments,
  economicDamages,
  heatRelatedFacilities,
  lifetimeExposure,
  maximumTemperature,
  meanTemperature,
  pathwayLegend,
  populationExposed,
} from '../series.js';

// The uid the embed route registers these charts under; a chart names itself
// within it with `?chart=<slug>`.
export const EMBED_UID = 'eu-scoreboard-chart';

// Where a data download would ask for a chart's series. NOTE: the API does not
// serve this yet — the scoreboard has no endpoints — so the download link 404s
// until it does. Everything else in the caption row is live.
export const DOWNLOAD_ENDPOINT = 'scoreboard-series';

// Until the endpoints land the numbers are made up, and the chart says so
// rather than letting a reader take them for model output.
const PLACEHOLDER = { label: 'Data', value: 'Placeholder series' };
const DECADAL = { label: 'Time resolution', value: '10 years' };

// One download per member of the dimension the chart is split by, plus the
// format — the same shape explore's charts offer.
const downloadOptions = (label, options) => [
  { uid: 'series', label, options: options.map(({ uid, label }) => ({ uid, label })) },
  { uid: 'format', label: 'Format', options: [{ uid: 'csv', label: 'csv' }] },
];

const pathwayOptions = (series) => downloadOptions('Scenario', series);
const countryOptions = (series) => downloadOptions('Country', series);

export const charts = [
  {
    slug: 'annual-mean-temperature',
    short: 'Mean Temperature',
    title: 'Annual Mean Temperature (MESMER)',
    description: 'How the yearly average temperature moves under each pathway, with the spread across the ensemble shown as a band around the high scenario.',
    component: LineChart,
    props: { series: meanTemperature, legend: pathwayLegend(meanTemperature), yLabel: 'raw value (ΔT °C)' },
    info: [{ label: 'Model', value: 'MESMER' }, DECADAL, PLACEHOLDER],
    downloadOptions: pathwayOptions(meanTemperature),
  },
  {
    slug: 'annual-maximum-temperature',
    short: 'Maximum temperature',
    title: 'Annual Maximum Temperature (MESMER)',
    description: 'The hottest day of the year, which drives heat stress thresholds far more directly than the annual mean does.',
    component: LineChart,
    props: { series: maximumTemperature, legend: pathwayLegend(maximumTemperature), yLabel: 'raw value (ΔT °C)' },
    info: [{ label: 'Model', value: 'MESMER' }, DECADAL, PLACEHOLDER],
    downloadOptions: pathwayOptions(maximumTemperature),
  },
  {
    slug: 'population-exposed',
    short: 'Population exposed',
    title: 'Population exposed to extreme temperature values (CLIMADA)',
    description: 'How many people live where extreme temperatures are reached, broken down by region and stacked from the lowest pathway upwards.',
    component: StackedBarChart,
    props: { rows: populationExposed, layers: EXPOSURE_LAYERS, xLabel: 'million people exposed', unitLabel: 'million people', height: 'h-[420px]' },
    caseStudy: true,
    info: [{ label: 'Model', value: 'CLIMADA' }, { label: 'Spatial resolution', value: 'NUTS-2' }, PLACEHOLDER],
    downloadOptions: downloadOptions('Region', populationExposed),
  },
  {
    slug: 'lifetime-exposure',
    short: 'Lifetime exposure',
    title: 'Lifetime exposure to heatwaves',
    description: 'The number of heatwaves a person born today can expect to live through, under each pathway.',
    component: LineChart,
    props: { series: lifetimeExposure, legend: pathwayLegend(lifetimeExposure), yLabel: 'heatwaves per lifetime' },
    caseStudy: true,
    info: [{ label: 'Birth year', value: '2025' }, DECADAL, PLACEHOLDER],
    downloadOptions: pathwayOptions(lifetimeExposure),
  },
  {
    slug: 'heat-related-facilities',
    short: 'Heat-related facilities',
    title: 'Heat-related facilities (CLIMADA)',
    description: 'Exposure of health and care facilities to heat, compared across countries rather than across scenarios.',
    component: LineChart,
    props: { series: heatRelatedFacilities, yLabel: 'score' },
    caseStudy: true,
    info: [{ label: 'Model', value: 'CLIMADA' }, DECADAL, PLACEHOLDER],
    downloadOptions: countryOptions(heatRelatedFacilities),
  },
  {
    slug: 'economic-damages',
    short: 'Economic damages',
    title: 'Heatwaves — economic damages',
    description: 'Modelled annual damages attributable to heatwaves, compared across countries.',
    component: LineChart,
    props: { series: economicDamages, yLabel: '€ billion per year' },
    caseStudy: true,
    info: [{ label: 'Model', value: 'CLIMADA' }, DECADAL, PLACEHOLDER],
    downloadOptions: countryOptions(economicDamages),
  },
  {
    slug: 'adaptation-investments',
    short: 'Adaptation investments',
    title: 'Heat-adaptation investments (CLIMADA)',
    description: 'Where today’s heat stress meets the adaptation investment a country is projected to need, with each bubble sized by the population exposed.',
    component: BubbleChart,
    props: {
      points: adaptationInvestments,
      levels: RISK_LEVELS,
      reference: ADAPTATION_REFERENCE,
      quadrantLabels: {
        topLeft: 'Low score · fast growth',
        topRight: 'High score · fast growth',
        bottomLeft: 'Low score · slow growth',
        bottomRight: 'High score · slow growth',
      },
      sizeLabel: 'Dot size = population exposed',
      xLabel: 'heat stress score (2025)',
      yLabel: 'avg annual score increase (2025–2080)',
      xDomain: [0, 100],
      // A score has no decimals; the growth rate is only legible with two.
      formatX: (d) => String(d),
      formatY: (d) => `+${d.toFixed(2)}/yr`,
      formatSize: (d) => `${d} million`,
      tooltipLabels: { x: 'Heat stress score', y: 'Annual increase', size: 'Population exposed' },
      height: 'h-[460px]',
    },
    caseStudy: true,
    info: [{ label: 'Model', value: 'CLIMADA' }, { label: 'Reference year', value: '2025' }, PLACEHOLDER],
    downloadOptions: countryOptions(adaptationInvestments),
  },
];

export const chartBySlug = (slug) => charts.find((chart) => chart.slug === slug);

// What the caption row hands the download menus for one chart. The graph
// download screenshots the embed, so its params are what the embed route reads;
// the data download describes the selection the series would be fetched for.
export const graphParamsFor = (chart) => ({ chart: chart.slug });

export const dataParamsFor = (chart, { geography, scenario, year } = {}) => ({
  indicator: chart.slug,
  geography: geography?.uid ?? 'europe',
  scenario: scenario?.uid,
  year: year?.uid,
});
