<script context="module">
  export const calls = [];
  export const events = new Map();
  export function emit(name, event) {
    for (const [key, handler] of events) {
      if (key.startsWith(`${name}:`)) handler(event);
    }
  }
</script>

<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import RegionalChoropleth from './RegionalChoropleth.svelte';

  export let shape;
  export let values = [];
  export let classes = [];
  export let unit = undefined;

  const layers = new Set();
  const sources = new Map();
  const map = {
    getStyle: () => ({ layers: [] }),
    addSource: (id, source) => {
      sources.set(id, {
        setData: (data) => calls.push(['setData', id, data]),
      });
      calls.push(['addSource', id, source]);
    },
    getSource: (id) => sources.get(id),
    removeSource: (id) => sources.delete(id),
    addLayer: (layer) => {
      layers.add(layer.id);
      calls.push(['addLayer', layer]);
    },
    getLayer: (id) => layers.has(id),
    removeLayer: (id) => layers.delete(id),
    setPaintProperty: (...args) => calls.push(['setPaintProperty', ...args]),
    setFilter: (...args) => calls.push(['setFilter', ...args]),
    getCanvas: () => ({ clientWidth: 500, clientHeight: 400 }),
    on: (name, layer, handler) => events.set(`${name}:${layer}`, handler),
    off: (name, layer) => events.delete(`${name}:${layer}`),
  };

  setContext('mapbox', { map: readable(map) });
  setContext('theme', readable({ color: { surface: { base: '#fff' }, contour: { base: '#1b1e20', weaker: '#7b8790' } } }));
</script>

<RegionalChoropleth {shape} {values} {classes} {unit} />
