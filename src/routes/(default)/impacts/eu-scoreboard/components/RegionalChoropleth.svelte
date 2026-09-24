<script context="module">
  let instance = 0;
</script>

<script>
  import { getContext, onDestroy } from 'svelte';
  import { classOf, regionalFillColor, regionalFilter } from './choropleth.js';

  export let shape;
  export let values = [];
  export let classes = [];
  export let fillOpacity = 0.8;
  export let unit = undefined;

  const { map } = getContext('mapbox');
  const theme = getContext('theme');
  const sourceId = `nuts-regions-${instance}`;
  const fillLayerId = `nuts-regions-fill-${instance}`;
  const borderLayerId = `nuts-regions-border-${instance}`;
  const lineLayerId = `nuts-regions-line-${instance}`;
  instance += 1;

  let hover;
  const number = new Intl.NumberFormat('en', { maximumFractionDigits: 4 });
  $: hoveredValue = hover ? values.find(({ region }) => region === hover.region)?.value : undefined;
  $: hoveredClass = classOf(hoveredValue, classes);

  function showHover({ features, point }) {
    const properties = features?.[0]?.properties;
    const region = properties?.NUTS_ID;
    if (!region || !Number.isFinite(values.find((entry) => entry.region === region)?.value)) {
      hover = undefined;
      return;
    }
    const canvas = $map.getCanvas();
    const x = Math.max(8, Math.min(point.x + 14, canvas.clientWidth - 220));
    const below = point.y + 14;
    const y = below + 100 <= canvas.clientHeight ? below : Math.max(8, point.y - 100);
    hover = { region, label: String(properties.NAME_LATN ?? properties.NUTS_NAME ?? region), x, y };
  }

  function clearHover() {
    hover = undefined;
  }

  const insertionLayer = () => {
    const layers = $map.getStyle().layers;
    return layers.find(({ id }) => id.startsWith('country-choropleth-fill-'))?.id ?? layers.find(({ type }) => type === 'symbol')?.id;
  };

  $map.addSource(sourceId, {
    type: 'geojson',
    data: shape,
    attribution: '© IIASA Scenario Services team; boundaries © EuroGeographics / EUROSTAT (NUTS 2024, CC BY 4.0)',
  });
  const before = insertionLayer();
  $map.addLayer(
    {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': regionalFillColor(values, classes),
        'fill-opacity': fillOpacity,
        'fill-antialias': true,
      },
    },
    before
  );

  $map.on('mousemove', fillLayerId, showHover);
  $map.on('click', fillLayerId, showHover);
  $map.on('mouseleave', fillLayerId, clearHover);
  $map.on('movestart', clearHover);
  $map.addLayer(
    {
      id: borderLayerId,
      type: 'line',
      source: sourceId,
      filter: regionalFilter(values, classes),
      paint: { 'line-color': $theme.color.contour.base, 'line-width': 2, 'line-opacity': 0.7 },
    },
    before
  );
  $map.addLayer(
    {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      filter: regionalFilter(values, classes),
      paint: { 'line-color': $theme.color.surface.base, 'line-width': 0.7 },
    },
    before
  );

  $: $map.getSource(sourceId)?.setData(shape);

  $: if ($map.getLayer(fillLayerId)) {
    $map.setPaintProperty(fillLayerId, 'fill-color', regionalFillColor(values, classes));
    $map.setFilter(borderLayerId, regionalFilter(values, classes));
    $map.setFilter(lineLayerId, regionalFilter(values, classes));
  }

  onDestroy(() => {
    try {
      $map.off('mousemove', fillLayerId, showHover);
      $map.off('click', fillLayerId, showHover);
      $map.off('mouseleave', fillLayerId, clearHover);
      $map.off('movestart', clearHover);
      if ($map.getLayer(lineLayerId)) $map.removeLayer(lineLayerId);
      if ($map.getLayer(borderLayerId)) $map.removeLayer(borderLayerId);
      if ($map.getLayer(fillLayerId)) $map.removeLayer(fillLayerId);
      if ($map.getSource(sourceId)) $map.removeSource(sourceId);
    } catch (error) {
      console.error(error);
    }
  });
</script>

{#if hover && Number.isFinite(hoveredValue) && hoveredClass}
  <div
    role="tooltip"
    class="pointer-events-none absolute z-20 w-52 overflow-hidden rounded border border-contour-weakest bg-surface-base px-4 py-3 shadow-lg"
    style={`left: ${hover.x}px; top: ${hover.y}px;`}
  >
    <span class="absolute inset-y-0 left-0 w-1" style={`background-color: ${hoveredClass.color}`}></span>
    <p class="text-sm font-semibold leading-tight text-theme-stronger">{hover.label}</p>
    <p class="mt-1 text-lg font-semibold leading-tight tabular-nums text-text-base">{number.format(hoveredValue)}{unit ? ` ${unit}` : ''}</p>
  </div>
{/if}
