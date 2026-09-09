<script context="module">
  let instance = 0;
</script>

<script>
  import { createEventDispatcher, getContext, onDestroy } from 'svelte';
  import { colorFor, countryFillColor, countryFilter, scoredCountryFilter, uidForCode, COUNTRY_CODE_PROPERTY, WORLDVIEW_FILTER } from './choropleth.js';

  // A country choropleth drawn straight from Mapbox's `country-boundaries-v1`
  // tileset: vector tiles at the basemap's own resolution, so borders and
  // coastlines stay sharp at every zoom instead of going blocky the way a
  // simplified geojson does. Lives inside MapProvider — the map comes from its
  // context.
  export let values = [];
  export let classes = [];
  export let fillOpacity = 0.8;
  // Geo id of the country the view is scoped to, outlined so the selection is
  // visible on a map that is otherwise all one choropleth.
  export let highlight = undefined;
  // Whether a country can be clicked. Only set it where the `select` event is
  // acted on: it is what puts the pointer cursor on the map, and a cursor that
  // promises a click nothing handles is worse than no cursor at all.
  export let selectable = false;

  const { map } = getContext('mapbox');
  const theme = getContext('theme');
  const dispatch = createEventDispatcher();

  const sourceId = `country-boundaries-${instance}`;
  const fillLayerId = `country-choropleth-fill-${instance}`;
  const lineLayerId = `country-choropleth-line-${instance}`;
  const highlightLayerId = `country-choropleth-highlight-${instance}`;
  instance++;

  // Under the basemap's labels, over its land and water, so place names stay
  // readable on top of the fill.
  const symbolLayers = () => $map.getStyle().layers.filter(({ type }) => type === 'symbol');
  const firstSymbolLayer = () => symbolLayers()[0]?.id;

  // The basemap's labels are set for a pale ground, and the fill underneath them
  // goes as dark as the top class. Halo every label in the surface colour so
  // place names stay readable whatever class they sit on. Swept over the style's
  // symbol layers rather than named one by one, so it survives a basemap change.
  function haloLabels() {
    symbolLayers().forEach(({ id }) => {
      $map.setPaintProperty(id, 'text-halo-color', $theme.color.surface.base);
      $map.setPaintProperty(id, 'text-halo-width', 1.4);
      $map.setPaintProperty(id, 'text-halo-blur', 0);
    });
  }

  if (!$map.getSource(sourceId)) {
    $map.addSource(sourceId, { type: 'vector', url: 'mapbox://mapbox.country-boundaries-v1' });
  }

  const before = firstSymbolLayer();

  if (!$map.getLayer(fillLayerId)) {
    $map.addLayer(
      {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        'source-layer': 'country_boundaries',
        filter: WORLDVIEW_FILTER,
        paint: {
          'fill-color': countryFillColor(values, classes),
          'fill-opacity': fillOpacity,
          'fill-antialias': true,
        },
      },
      before
    );
  }

  if (!$map.getLayer(lineLayerId)) {
    $map.addLayer(
      {
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': 'country_boundaries',
        filter: scoredCountryFilter(values, classes),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': $theme.color.surface.base,
          'line-width': 0.8,
        },
      },
      before
    );
  }

  // Over the choropleth's own borders, still under the labels.
  if (!$map.getLayer(highlightLayerId)) {
    $map.addLayer(
      {
        id: highlightLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': 'country_boundaries',
        filter: countryFilter(highlight ? [highlight] : []),
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': $theme.color.contour.base,
          'line-width': 2,
        },
      },
      before
    );
  }

  // The basemap is a city-first style: it carries country names but hides them,
  // so a map of countries labelled only with cities is what you get. A
  // choropleth of countries needs the country names.
  function showCountryLabels() {
    if ($map.getLayer('country-label')) $map.setLayoutProperty('country-label', 'visibility', 'visible');
  }

  showCountryLabels();
  haloLabels();

  // Only the countries this map has a colour for can be opened — the rest of the
  // world is basemap the scoreboard says nothing about. Read from the values
  // rather than from a separate list so the clickable countries are exactly the
  // painted ones.
  $: scoredUids = values.flatMap((entry) => (colorFor(entry.value, classes) ? [entry.uid] : []));

  const codeOf = (feature) => feature?.properties?.[COUNTRY_CODE_PROPERTY];

  function handleClick({ features }) {
    const uid = uidForCode(codeOf(features?.[0]), scoredUids);
    if (uid) dispatch('select', { uid });
  }

  // The fill layer covers every country, so the cursor has to follow what is
  // actually scored rather than the layer as a whole.
  function handleMove({ features }) {
    const uid = uidForCode(codeOf(features?.[0]), scoredUids);
    $map.getCanvas().style.cursor = uid ? 'pointer' : '';
  }

  function clearCursor() {
    $map.getCanvas().style.cursor = '';
  }

  $: if ($map.getLayer(fillLayerId)) {
    // Re-attached rather than guarded inside the handlers, so a map that is not
    // selectable carries no listeners at all.
    $map.off('click', fillLayerId, handleClick);
    $map.off('mousemove', fillLayerId, handleMove);
    $map.off('mouseleave', fillLayerId, clearCursor);
    if (selectable) {
      $map.on('click', fillLayerId, handleClick);
      $map.on('mousemove', fillLayerId, handleMove);
      $map.on('mouseleave', fillLayerId, clearCursor);
    } else {
      clearCursor();
    }
  }

  // Repaint rather than rebuild when the selection changes: the geometry is the
  // same tiles, only the colour each country takes is different.
  $: if ($map.getLayer(fillLayerId)) {
    $map.setPaintProperty(fillLayerId, 'fill-color', countryFillColor(values, classes));
    $map.setFilter(lineLayerId, scoredCountryFilter(values, classes));
  }

  $: if ($map.getLayer(highlightLayerId)) {
    $map.setFilter(highlightLayerId, countryFilter(highlight ? [highlight] : []));
  }

  onDestroy(() => {
    try {
      $map.off('click', fillLayerId, handleClick);
      $map.off('mousemove', fillLayerId, handleMove);
      $map.off('mouseleave', fillLayerId, clearCursor);
      clearCursor();
      $map.getLayer(highlightLayerId) && $map.removeLayer(highlightLayerId);
      $map.getLayer(lineLayerId) && $map.removeLayer(lineLayerId);
      $map.getLayer(fillLayerId) && $map.removeLayer(fillLayerId);
      $map.getSource(sourceId) && $map.removeSource(sourceId);
    } catch (e) {
      console.log(e);
    }
  });
</script>
