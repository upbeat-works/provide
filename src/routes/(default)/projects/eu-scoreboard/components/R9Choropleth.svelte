<script context="module">
  let instance = 0;
</script>

<script>
  import { getContext, onDestroy } from 'svelte';
  import { r9FillColor, r9Filter } from './choropleth.js';

  export let values = [];
  export let classes = [];
  export let fillOpacity = 0.8;

  const { map } = getContext('mapbox');
  const theme = getContext('theme');
  const sourceId = `r9-regions-${instance}`;
  const fillLayerId = `r9-choropleth-fill-${instance}`;
  const lineLayerId = `r9-choropleth-line-${instance}`;
  instance++;

  const firstSymbolLayer = () => $map.getStyle().layers.find(({ type }) => type === 'symbol')?.id;
  $map.addSource(sourceId, {
    type: 'geojson',
    data: '/data/eu-scoreboard/r9_regions.geojson',
    attribution: '© IIASA Scenario Services team; boundaries made with Natural Earth (CC BY 4.0)',
  });
  const before = firstSymbolLayer();
  $map.addLayer(
    {
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: { 'fill-color': r9FillColor(values, classes), 'fill-opacity': fillOpacity, 'fill-antialias': true },
    },
    before
  );
  $map.addLayer(
    {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      filter: r9Filter(values, classes),
      paint: { 'line-color': $theme.color.surface.base, 'line-width': 0.8 },
    },
    before
  );

  $: if ($map.getLayer(fillLayerId)) {
    $map.setPaintProperty(fillLayerId, 'fill-color', r9FillColor(values, classes));
    $map.setFilter(lineLayerId, r9Filter(values, classes));
  }

  onDestroy(() => {
    try {
      if ($map.getLayer(lineLayerId)) $map.removeLayer(lineLayerId);
      if ($map.getLayer(fillLayerId)) $map.removeLayer(fillLayerId);
      if ($map.getSource(sourceId)) $map.removeSource(sourceId);
    } catch (error) {
      console.error(error);
    }
  });
</script>
