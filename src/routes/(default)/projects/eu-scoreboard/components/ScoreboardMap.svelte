<script>
  import { writable } from 'svelte/store';
  import MapProvider from '$lib/components/maps/MapboxMap/MapProvider.svelte';
  import ZoomControl from '$lib/components/maps/MapboxMap/ZoomControl.svelte';
  import CountryChoropleth from './CountryChoropleth.svelte';
  import { countryBounds } from './choropleth.js';
  import { fetchData } from '$lib/api/api';
  import { END_GEO_SHAPE, STATUS_SUCCESS } from '$config';

  // The scoreboard's map band: a country choropleth over the basemap. Both views
  // use it — the ranking view colours countries by their composite score, the
  // indicators view by the selected indicator — so what is mapped comes in as
  // values plus the classes that turn a value into a colour.
  export let bounds = [9.53, 46.37, 17.16, 49.02];
  export let height = 'h-[420px]';
  // `[{ uid, label, value }]`, keyed on the country's alpha-3 geo id (`ITA`).
  export let values = [];
  export let classes = [];
  // Geo id of the country the view is scoped to, if any. The map outlines it and
  // frames it; with none, it frames `bounds` — the whole coverage.
  export let highlight = undefined;
  // Keeps the fitted shape off the edges of the band. A fixed inset rather than
  // a fraction of the width, so a map narrowed by a comparison keeps it.
  export let padding = 48;

  // Framing needs geometry, and the choropleth's vector tiles carry none we can
  // measure, so the country outlines come from geo-shape — fetched the first
  // time a country is picked (and cached, shared with the geography modal), so
  // the default Europe-wide view never pays for them.
  const GEO_SHAPE_DATA = writable({});
  let requested = false;
  $: if (highlight && !requested) {
    requested = true;
    fetchData(GEO_SHAPE_DATA, { endpoint: END_GEO_SHAPE, params: { 'geography-type': 'admin0' } });
  }

  $: shape = $GEO_SHAPE_DATA.status === STATUS_SUCCESS ? $GEO_SHAPE_DATA.data?.data : undefined;
  // Falls back to the full frame while the shapes are still in flight.
  $: frame = (highlight && shape && countryBounds(shape, highlight)) || bounds;
</script>

<div class="{height} w-full">
  <MapProvider bounds={frame} fitBoundsOptions={{ padding }}>
    <ZoomControl />
    <CountryChoropleth {values} {classes} {highlight} />
    <slot />
  </MapProvider>
</div>
