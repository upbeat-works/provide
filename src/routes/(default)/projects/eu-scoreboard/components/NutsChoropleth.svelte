<script context="module">
  let instance = 0;
</script>

<script>
  import { createEventDispatcher, getContext, onDestroy } from 'svelte';
  import { countryFillColor, countryFilter, scoredCountryFilter, COUNTRY_CODE_PROPERTY } from './choropleth.js';

  export let shape;
  export let values = [];
  export let classes = [];
  export let fillOpacity = 0.8;
  export let highlight = undefined;
  export let selectable = false;

  const { map } = getContext('mapbox');
  const theme = getContext('theme');
  const dispatch = createEventDispatcher();

  const sourceId = `nuts0-countries-${instance}`;
  const fillLayerId = `country-choropleth-fill-${instance}`;
  const lineLayerId = `country-choropleth-line-${instance}`;
  const highlightLayerId = `country-choropleth-highlight-${instance}`;
  instance++;

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
    $map.addSource(sourceId, {
      type: 'geojson',
      data: shape ?? { type: 'FeatureCollection', features: [] },
      attribution: '© IIASA Scenario Services team; boundaries © EuroGeographics / EUROSTAT (NUTS 2024, CC BY 4.0)',
    });
  }

  const before = firstSymbolLayer();

  if (!$map.getLayer(fillLayerId)) {
    $map.addLayer(
      {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
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

  if (!$map.getLayer(highlightLayerId)) {
    $map.addLayer(
      {
        id: highlightLayerId,
        type: 'line',
        source: sourceId,
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

  const codeOf = (feature) => feature?.properties?.[COUNTRY_CODE_PROPERTY];
  const uidAt = (features) => codeOf(features?.[0]);

  function handleClick({ features }) {
    const uid = uidAt(features);
    if (uid) dispatch('select', { uid });
  }

  function handleMove({ features }) {
    $map.getCanvas().style.cursor = uidAt(features) ? 'pointer' : '';
  }

  function clearCursor() {
    $map.getCanvas().style.cursor = '';
  }

  $: if ($map.getLayer(fillLayerId)) {
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
