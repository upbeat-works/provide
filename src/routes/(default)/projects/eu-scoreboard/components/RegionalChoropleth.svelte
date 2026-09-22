<script context="module">
  let instance = 0;
</script>

<script>
  import { getContext, onDestroy } from 'svelte';
  import { regionalFillColor, regionalFilter } from './choropleth.js';

  export let shape;
  export let values = [];
  export let classes = [];
  export let fillOpacity = 0.8;

  const { map } = getContext('mapbox');
  const theme = getContext('theme');
  const sourceId = `nuts-regions-${instance}`;
  const fillLayerId = `nuts-regions-fill-${instance}`;
  const lineLayerId = `nuts-regions-line-${instance}`;
  instance += 1;

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
  $map.addLayer(
    {
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      filter: regionalFilter(values, classes),
      paint: { 'line-color': $theme.color.surface.base, 'line-width': 0.8 },
    },
    before
  );

  $: $map.getSource(sourceId)?.setData(shape);

  $: if ($map.getLayer(fillLayerId)) {
    $map.setPaintProperty(fillLayerId, 'fill-color', regionalFillColor(values, classes));
    $map.setFilter(lineLayerId, regionalFilter(values, classes));
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
