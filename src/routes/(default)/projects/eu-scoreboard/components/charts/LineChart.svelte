<script>
  import LineTimeSeries from '$lib/components/charts/LineTimeSeries.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import { seriesLegend } from '../series.js';
  import { findDecimalsForDistinctValues, formatValue } from '$lib/utils/formatting';
  import { DEFAULT_FORMAT_UID } from '$src/config.js';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-series.html?raw';
  import rangeRowTemplate from './popover-series-range.html?raw';

  // LN-01 (scenario pathways) and LN-02 (projection range) — the same chart with
  // and without a band, which is why one component serves both: a series that
  // carries min/max gets a band, one that doesn't is a plain line.
  export let series = [];
  export let yLabel = undefined;
  // Defaults to one stroke per series; a banded chart passes `pathwayLegend`,
  // which names the band first.
  export let legend = undefined;
  export let unit = undefined;
  export let height = 'h-[360px]';

  // What the band's row in a tooltip is called, where there is a band.
  export let rangeLabel = 'Ensemble spread';

  // Every decade the series carries, rather than d3's own tick choice — the
  // series are decadal steps, so a tick that falls between two of them names a
  // year the chart has no value for.
  $: years = [...new Set(series.flatMap(({ values = [] }) => values.map(({ year }) => year)))].sort((a, b) => a - b);

  $: unitUID = unit?.uid ?? unit ?? DEFAULT_FORMAT_UID;

  // Enough decimals to tell the values apart and no more, the way ImpactTime
  // sizes its tooltips — the axis can round 0.8 to 1, a tooltip must not.
  $: decimals = findDecimalsForDistinctValues(
    series.flatMap(({ values = [] }) => values.map(({ value }) => value)),
    unitUID,
    0,
    2
  );
  $: format = (d) => formatValue(d, unitUID, { decimals });

  // Only the banded series has bounds, so its extra row is rendered separately
  // and dropped into the tooltip; the rest get an empty string there.
  const bandRow = (d, format, rangeLabel) => (Number.isFinite(d.min) && Number.isFinite(d.max) ? renderTemplate(rangeRowTemplate, { rangeLabel, range: `${format(d.min)} – ${format(d.max)}` }) : '');

  // A point carries its own tooltip, which is what SeriesDots hangs off it.
  $: tooltipSeries = series.map((entry) => ({
    ...entry,
    values: (entry.values ?? []).map((d) => ({
      ...d,
      popoverContent: renderTemplate(popoverTemplate, {
        label: entry.label,
        year: d.year,
        formattedValue: format(d.value),
        rangeRow: bandRow(d, format, rangeLabel),
      }),
    })),
  }));
</script>

<!-- Anything else the caller passes is the caption row's (chart info, the two
     downloads); ChartFigure declares those, so they arrive here as rest props. -->
<ChartFigure legend={legend ?? seriesLegend(series)} {yLabel} {height} {...$$restProps}>
  <LineTimeSeries data={tooltipSeries} xTicks={years} yTicks={6} {unit} showDots strokeWidth={3} />
</ChartFigure>
