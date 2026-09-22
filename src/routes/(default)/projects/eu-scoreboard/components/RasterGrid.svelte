<script context="module">
  let instance = 0;
</script>

<script>
  import { getContext, onDestroy } from 'svelte';
  import { rasterFeatures } from './choropleth.js';

  export let grid;
  export let classes = [];
  export let mask = undefined;

  const { map } = getContext('mapbox');
  const sourceId = `scoreboard-raster-${instance}`;
  const layerId = `scoreboard-raster-fill-${instance}`;
  instance += 1;

  const firstSymbolLayer = () => $map.getStyle().layers.find(({ type }) => type === 'symbol')?.id;

  $map.addSource(sourceId, {
    type: 'geojson',
    data: rasterFeatures(grid, classes, mask),
    attribution: '© IIASA Scenario Services team',
  });
  $map.addLayer({
    id: layerId,
    type: 'fill',
    source: sourceId,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.8, 'fill-antialias': false },
  }, firstSymbolLayer());

  $: $map.getSource(sourceId)?.setData(rasterFeatures(grid, classes, mask));

  onDestroy(() => {
    try {
      if ($map.getLayer(layerId)) $map.removeLayer(layerId);
      if ($map.getSource(sourceId)) $map.removeSource(sourceId);
    } catch (error) {
      console.error(error);
    }
  });
</script>
