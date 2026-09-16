<script context="module">
  export const calls = [];
</script>

<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import R9Choropleth from './R9Choropleth.svelte';

  export let values = [];
  export let classes = [];
  const layers = new Set();
  const sources = new Set();
  const map = {
    getStyle: () => ({ layers: [] }),
    addSource: (id, source) => {
      sources.add(id);
      calls.push(['addSource', id, source]);
    },
    getSource: (id) => sources.has(id),
    removeSource: (id) => sources.delete(id),
    addLayer: (layer) => {
      layers.add(layer.id);
      calls.push(['addLayer', layer]);
    },
    getLayer: (id) => layers.has(id),
    removeLayer: (id) => layers.delete(id),
    setPaintProperty: (...args) => calls.push(['setPaintProperty', ...args]),
    setFilter: (...args) => calls.push(['setFilter', ...args]),
  };
  setContext('mapbox', { map: readable(map) });
  setContext('theme', readable({ color: { surface: { base: '#fff' } } }));
</script>

<R9Choropleth {values} {classes} />
