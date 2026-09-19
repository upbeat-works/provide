<script context="module">
  export const calls = [];
</script>

<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import NutsChoropleth from './NutsChoropleth.svelte';

  export let shape = undefined;
  export let values = [];
  export let classes = [];
  export let highlight = undefined;
  export let selectable = false;
  const layers = new Set();
  const sources = new Set();
  const handlers = new Map();
  const key = (event, layer) => `${event}:${layer}`;
  // Dispatched by event alone: the layer ids carry a module-level counter that
  // climbs with every render in the file, so a test naming one would be
  // asserting on how many components ran before it.
  export const fire = (event, payload) => {
    for (const [registered, listeners] of handlers) {
      if (registered.startsWith(`${event}:`)) listeners.forEach((handler) => handler(payload));
    }
  };
  export const cursor = () => map.getCanvas().style.cursor;
  const canvas = { style: { cursor: '' } };
  const map = {
    getStyle: () => ({ layers: [] }),
    getCanvas: () => canvas,
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
    setLayoutProperty: (...args) => calls.push(['setLayoutProperty', ...args]),
    setPaintProperty: (...args) => calls.push(['setPaintProperty', ...args]),
    setFilter: (...args) => calls.push(['setFilter', ...args]),
    on: (event, layer, handler) => {
      const existing = handlers.get(key(event, layer)) ?? new Set();
      existing.add(handler);
      handlers.set(key(event, layer), existing);
    },
    off: (event, layer, handler) => handlers.get(key(event, layer))?.delete(handler),
  };
  setContext('mapbox', { map: readable(map) });
  setContext('theme', readable({ color: { surface: { base: '#fff' }, contour: { base: '#000' } } }));
</script>

<NutsChoropleth {shape} {values} {classes} {highlight} {selectable} on:select />
