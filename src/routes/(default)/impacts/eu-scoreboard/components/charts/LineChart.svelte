<script>
  import LineTimeSeries from '$lib/components/charts/LineTimeSeries.svelte';
  import ChartFigure from './ChartFigure.svelte';
  import { findDecimalsForDistinctValues, formatValue } from '$lib/utils/formatting';
  import { DEFAULT_FORMAT_UID } from '$src/config.js';
  import renderTemplate from '$utils/renderTemplate';
  import popoverTemplate from './popover-series.html?raw';
  import rangeRowTemplate from './popover-series-range.html?raw';
  import { sampledTicks, splitLineAtGaps } from './adapter.js';

  export let series = [];
  export let yLabel = undefined;
  export let legend = undefined;
  export let unit = undefined;
  export let yDomain = undefined;
  export let height = 'h-[360px]';
  export let selectedYear = undefined;

  export let rangeLabel = 'Range';

  $: years = [...new Set(series.flatMap(({ values = [] }) => values.map(({ year }) => year)))].sort((a, b) => a - b);
  $: yearTicks = sampledTicks(years);

  $: unitUID = unit?.uid ?? unit ?? DEFAULT_FORMAT_UID;

  $: decimals = findDecimalsForDistinctValues(
    series.flatMap(({ values = [] }) => values.map(({ value }) => value)),
    unitUID,
    0,
    2
  );
  $: format = (d) => formatValue(d, unitUID, { decimals });

  const bandRow = (d, format, rangeLabel) => (Number.isFinite(d.min) && Number.isFinite(d.max) ? renderTemplate(rangeRowTemplate, { rangeLabel, range: `${format(d.min)} – ${format(d.max)}` }) : '');

  $: tooltipSeries = series.flatMap(splitLineAtGaps).map((entry) => ({
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

  $: resolvedLegend = legend ?? series.map(({ uid, label, color, dash }) => ({ uid, label, color, dash, variant: 'line' }));
</script>

<ChartFigure legend={resolvedLegend} {yLabel} {height} {...$$restProps}>
  <LineTimeSeries data={tooltipSeries} xTicks={yearTicks} yTicks={6} {unit} {yDomain} {selectedYear} showDots strokeWidth={3} />
</ChartFigure>
