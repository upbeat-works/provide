# PROVIDE Project - Technical Implementation Plan

## Table of Contents
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Phase 1: Projects Hub Implementation](#2-phase-1-projects-hub-implementation)
3. [Phase 2: GeoServer + MVT Migration](#3-phase-2-geoserver--mvt-migration)
4. [Phase 3: Case Studies Enhancement](#4-phase-3-case-studies-enhancement)
5. [Implementation Checklist](#5-implementation-checklist)

---

## 1. Current Architecture Overview

### 1.1 Directory Structure

```
provide/
├── src/
│   ├── config.js                    # Global constants & configuration
│   ├── stores/
│   │   ├── state.js                 # Main app state (589 lines)
│   │   ├── avoid.js                 # Avoiding impacts state (107 lines)
│   │   ├── meta.js                  # Metadata derived stores
│   │   └── impact.js                # Impact data store
│   ├── routes/
│   │   ├── (default)/
│   │   │   ├── +layout.svelte       # Main layout with Header/Footer
│   │   │   ├── impacts/
│   │   │   │   ├── +layout.svelte   # Impacts layout with tabs
│   │   │   │   ├── avoid/           # Avoiding Future Impacts module
│   │   │   │   ├── explore/         # Future Impacts module
│   │   │   │   ├── MainControls/    # Shared controls
│   │   │   │   └── UnavoidableRisk/ # Risk visualization
│   │   │   ├── adaptation/          # Case studies
│   │   │   └── [other pages...]
│   │   └── (embed)/                 # Embed routes
│   ├── lib/
│   │   ├── api/                     # API client
│   │   ├── charts/                  # Chart components (LayerCake)
│   │   ├── MapboxMap/               # Map components
│   │   ├── helper/                  # Utility components
│   │   └── utils/                   # Utilities including geo.js
│   └── styles/                      # TailwindCSS & theme
├── svelte.config.js                 # SvelteKit configuration
└── package.json                     # Dependencies
```

### 1.2 Avoiding Future Impacts Module Structure

```
src/routes/(default)/impacts/avoid/
├── +page.svelte                     # Main page (79 lines)
├── +page.server.js                  # Server load function
├── Reference/
│   ├── Reference.svelte             # Impact level reference selector
│   ├── ImpactLevel.svelte           # Slider display
│   ├── Text.svelte                  # Reference text
│   └── Slider/Knob.svelte           # Custom slider control
├── Selection/
│   ├── CertaintyLevels/
│   │   ├── CertaintyLevels.svelte   # Probability selector
│   │   └── CertaintyLevelsList.svelte
│   └── StudyLocations/
│       ├── StudyLocations.svelte    # Location selector
│       └── LocationsList.svelte
├── ThresholdLevels/
│   ├── ThresholdLevels.svelte       # Main threshold section
│   ├── Interactive.svelte           # Interactive chart
│   ├── Text.svelte
│   └── Important.svelte
└── StudyLocations/
    ├── StudyLocations.svelte        # Locations display
    ├── Locations.svelte
    └── Map.svelte                   # Location map
```

### 1.3 State Management Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         URL Parameters                               │
│  ?indicator=X&geography=Y&level_of_impact=Z&certainty_level=W       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      urlToState() in +layout.svelte                  │
│                    Syncs URL params to Svelte stores                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Svelte Stores                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   state.js       │  │    avoid.js      │  │    meta.js       │   │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│   │
│  │ CURRENT_GEOGRAPHY│  │ SELECTED_        │  │ LIKELIHOODS      │   │
│  │ CURRENT_INDICATOR│  │ LIKELIHOOD_LEVEL │  │ STUDY_LOCATIONS  │   │
│  │ CURRENT_SCENARIOS│  │ SELECTED_        │  │ INDICATORS       │   │
│  │ IS_AVOID_PAGE    │  │ STUDY_LOCATION   │  │ GEOGRAPHIES      │   │
│  │ ...              │  │ LEVEL_OF_IMPACT  │  │ ...              │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Components Subscribe                            │
│         fetchData(store, { endpoint, params }) → API                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Key Configuration Constants

```javascript
// From src/config.js

// Route paths
export const PATH_EXPLORE = 'impacts';
export const PATH_AVOID = 'avoid';
export const PATH_IMPACT = 'explore';

// Labels
export const LABEL_AVOID_IMPACTS = 'Avoiding future impacts';
export const LABEL_FUTURE_IMPACTS = 'Future impacts';

// API endpoints
export const END_AVOIDING_IMPACTS = 'avoiding-impacts';
export const END_AVOIDING_REFERENCE = 'avoiding-reference';

// Constraints for Avoiding Impacts
export const GEOGRAPHY_TYPE_CITY = 'cities';
export const GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS = [GEOGRAPHY_TYPE_CITY];
export const SCENARIOS_IN_AVOIDING_IMPACTS = ['gs', 'sp', 'curpol'];

// LocalStorage keys
export const LOCALSTORE_LIKELIHOOD = 'likelihood';
export const LOCALSTORE_STUDY_LOCATION = 'study_location';
export const LOCALSTORE_LEVEL_OF_IMACT = 'level_of_impact';
```

---

## 2. Phase 1: Projects Hub Implementation

### 2.1 New Route Structure

```
src/routes/(default)/
├── projects/
│   ├── +page.svelte                      # Landing page with project cards
│   ├── +page.server.js                   # Load project metadata
│   └── avoiding-future-impact/
│       ├── +page.svelte                  # Standalone project page
│       ├── +page.server.js               # Server load
│       └── +layout.svelte                # Project-specific layout
└── impacts/
    └── avoid/
        └── +page.server.js               # Redirect to new location
```

### 2.2 Configuration Updates

**File: `src/config.js`**

```javascript
// Add new constants
export const PATH_PROJECTS = 'projects';
export const LABEL_PROJECTS = 'Projects';

// Projects registry
export const PROJECTS = [
  {
    slug: 'avoiding-future-impact',
    title: 'Avoiding Future Impacts',
    description: 'Explore which scenarios minimise the risk from certain impacts in cities.',
    thumbnail: '/images/projects/avoiding-future-impact.png',
    geographyTypes: [GEOGRAPHY_TYPE_CITY],
    scenarios: SCENARIOS_IN_AVOIDING_IMPACTS,
    isActive: true,
  },
];
```

### 2.3 Projects Landing Page

**File: `src/routes/(default)/projects/+page.svelte`**

```svelte
<script>
  import PageIntro from '$lib/site/PageIntro.svelte';
  import { LABEL_PROJECTS, PATH_PROJECTS } from '$config';

  export let data;
</script>

<PageIntro>
  <h1 class="text-3xl font-bold mb-4">{LABEL_PROJECTS}</h1>
  <p class="text-lg max-w-xl mb-8">
    Explore specialized tools and analyses built on climate risk data.
  </p>
</PageIntro>

<div class="mx-auto max-w-7xl px-6 py-12">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {#each data.projects as project}
      <a
        href="/{PATH_PROJECTS}/{project.slug}"
        class="group block bg-surface-weaker rounded-lg overflow-hidden
               hover:shadow-lg transition-shadow"
      >
        <div class="aspect-video bg-surface-weakest">
          {#if project.thumbnail}
            <img
              src={project.thumbnail}
              alt={project.title}
              class="w-full h-full object-cover"
            />
          {/if}
        </div>
        <div class="p-6">
          <h3 class="text-xl font-bold text-theme-base group-hover:underline">
            {project.title}
          </h3>
          <p class="mt-2 text-text-weaker">{project.description}</p>
        </div>
      </a>
    {/each}
  </div>
</div>
```

**File: `src/routes/(default)/projects/+page.server.js`**

```javascript
import { generatePageTitle } from '$utils/meta.js';
import { LABEL_PROJECTS, PROJECTS } from '$config';

export const load = async () => {
  return {
    title: generatePageTitle(LABEL_PROJECTS),
    projects: PROJECTS.filter(p => p.isActive),
  };
};
```

### 2.4 Avoiding Future Impact Project Page

**File: `src/routes/(default)/projects/avoiding-future-impact/+layout.svelte`**

```svelte
<script>
  import { page } from '$app/stores';
  import MainControls from '$routes/(default)/impacts/MainControls/MainControls.svelte';
  import PageIntro from '$lib/site/PageIntro.svelte';
  import ShareLink from '$routes/(default)/impacts/ShareLink/ShareLink.svelte';
  import { urlToState } from '$utils/url';
  import { PATH_PROJECTS, PATH_DOCUMENTATION } from '$config';

  $: urlToState($page.url);
</script>

<PageIntro backLink={{ href: `/${PATH_PROJECTS}`, label: 'All Projects' }}>
  <MainControls />
  <div class="flex flex-col gap-y-1">
    <h1 class="text-3xl font-bold">Avoiding Future Impacts in Cities</h1>
    <p class="text-lg mt-3.5 max-w-xl mb-8">
      Explore which scenarios minimise the risk from certain impacts in cities
      and their rural surroundings. Understand the likelihood of exceeding
      the impact levels you would like to avoid.
    </p>
    <div class="flex justify-between items-center">
      <a href="/{PATH_DOCUMENTATION}" class="text-sm font-bold text-theme-base hover:underline">
        Learn more about the methodology
      </a>
      <ShareLink />
    </div>
  </div>
</PageIntro>

<slot />
```

**File: `src/routes/(default)/projects/avoiding-future-impact/+page.svelte`**

```svelte
<script>
  // Import components from original location (or copy them)
  import ThresholdLevels from '$routes/(default)/impacts/avoid/ThresholdLevels/ThresholdLevels.svelte';
  import StudyLocations from '$routes/(default)/impacts/avoid/StudyLocations/StudyLocations.svelte';
  import Reference from '$routes/(default)/impacts/avoid/Reference/Reference.svelte';
  import ScrollContent from '$lib/helper/ScrollContent/ScrollContent.svelte';
  import SimpleNav from '$lib/helper/ScrollContent/SimpleNav.svelte';
  import FallbackMessage from '$lib/helper/FallbackMessage.svelte';
  import SelectionCertaintyLevels from '$routes/(default)/impacts/avoid/Selection/CertaintyLevels/CertaintyLevels.svelte';
  import SelectionStudyLocations from '$routes/(default)/impacts/avoid/Selection/StudyLocations/StudyLocations.svelte';

  import { IS_COMBINATION_AVAILABLE, IS_EMPTY_SELECTION, SELECTABLE_SCENARIOS } from '$stores/state';
  import { IS_EMPTY_LEVEL_OF_IMPACT, IS_EMPTY_LIKELIHOOD_LEVEL } from '$stores/avoid.js';
  import { SCENARIOS_IN_AVOIDING_IMPACTS, KEY_SCENARIO_ENDYEAR } from '$config';
  import THEME from '$styles/theme-store.js';
  import { writable } from 'svelte/store';

  $: isValidSelection = !$IS_EMPTY_SELECTION && $IS_COMBINATION_AVAILABLE
                        && !$IS_EMPTY_LEVEL_OF_IMPACT && !$IS_EMPTY_LIKELIHOOD_LEVEL;

  let THRESHOLD_LEVELS_DATA = writable({});
  let REFERENCE_STORE = writable({});

  $: currentScenarios = SCENARIOS_IN_AVOIDING_IMPACTS
    .map((uid) => $SELECTABLE_SCENARIOS.find((scenario) => scenario.uid === uid))
    .filter(Boolean)
    .map(({ uid, label, [KEY_SCENARIO_ENDYEAR]: timeframe }, i) => ({
      uid, label, [KEY_SCENARIO_ENDYEAR]: timeframe,
      color: $THEME.color.category.base[i]
    }));

  $: sections = [
    { component: FallbackMessage, disabled: isValidSelection },
    {
      slug: 'threshold-levels',
      title: 'Impact Level',
      description: 'When will the impact level be exceeded?',
      component: ThresholdLevels,
      disabled: !isValidSelection,
      props: { store: THRESHOLD_LEVELS_DATA, tagline: 'Impact Level' },
    },
    {
      slug: 'locations',
      title: 'Locations',
      description: 'When will the impact level be exceeded across different locations?',
      component: StudyLocations,
      disabled: !isValidSelection,
      props: { store: THRESHOLD_LEVELS_DATA, tagline: 'Locations' },
    },
  ];
</script>

<ScrollContent let:query {sections} isFullWidth={true} hasActiveScetionBar={true}>
  <aside slot="navigation" class="flex flex-col gap-4 pb-24">
    <div class="mr-2 mb-2 border-b border-contour-weakest pb-6 flex flex-col gap-y-6 pr-6 lg:pr-12">
      <Reference store={REFERENCE_STORE} />
      <SelectionCertaintyLevels />
      <SelectionStudyLocations />
    </div>
    <SimpleNav {sections} />
  </aside>
  {#each sections as section}
    {#if !section.disabled}
      <section id={section.slug} name={section.slug}
               class="scroll-mt-4 mb-16 {query} border-b pb-14 border-contour-weaker last:border-none">
        <svelte:component this={section.component} {...section.props} />
      </section>
    {/if}
  {/each}
</ScrollContent>
```

### 2.5 Backward Compatibility Redirect

**File: `src/routes/(default)/impacts/avoid/+page.server.js`** (updated)

```javascript
import { redirect } from '@sveltejs/kit';
import { PATH_PROJECTS } from '$config';

export const load = async ({ url }) => {
  // Preserve query parameters when redirecting
  const queryString = url.search;
  throw redirect(301, `/${PATH_PROJECTS}/avoiding-future-impact${queryString}`);
};
```

### 2.6 Header Navigation Update

**File: `src/lib/site/Header.svelte`**

```svelte
<script>
  import {
    PATH_KEY_CONCEPTS,
    LABEL_KEY_CONCEPTS,
    LABEL_EXPLORE,
    PATH_EXPLORE,
    PATH_IMPACT,
    LABEL_DOCUMENTATION,
    LABEL_CONTACT,
    LABEL_ABOUT,
    PATH_ABOUT,
    PATH_CONTACT,
    PATH_DOCUMENTATION,
    PATH_ADAPTATION,
    LABEL_ADAPTATION,
    PATH_PROJECTS,      // Add
    LABEL_PROJECTS,     // Add
  } from '$config';
  import NavLink from '$lib/helper/NavLink.svelte';
  import Logo from './Logo.svelte';

  const items = [
    { href: `/${PATH_EXPLORE}/${PATH_IMPACT}`, label: LABEL_EXPLORE },
    { href: `/${PATH_PROJECTS}`, label: LABEL_PROJECTS },  // Add Projects link
    { href: `/${PATH_ADAPTATION}`, label: LABEL_ADAPTATION },
    { href: `/${PATH_DOCUMENTATION}`, label: LABEL_DOCUMENTATION },
    { href: `/${PATH_KEY_CONCEPTS}`, label: LABEL_KEY_CONCEPTS },
    { href: `/${PATH_ABOUT}`, label: LABEL_ABOUT },
    { href: `/${PATH_CONTACT}`, label: LABEL_CONTACT },
  ];
</script>
<!-- Rest of component unchanged -->
```

### 2.7 Deep Linking from Explore Page

**File: `src/routes/(default)/impacts/explore/ImpactGeo/LinkSection.svelte`** (new component)

```svelte
<script>
  import { CURRENT_GEOGRAPHY, CURRENT_INDICATOR_UID, CURRENT_SCENARIOS_UID } from '$stores/state';
  import { GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS, SCENARIOS_IN_AVOIDING_IMPACTS, PATH_PROJECTS } from '$config';

  // Check if current selection is compatible with Avoiding Future Impacts
  $: isCompatible =
    $CURRENT_GEOGRAPHY?.geographyType &&
    GEOGRAPHY_TYPES_IN_AVOIDING_IMPACTS.includes($CURRENT_GEOGRAPHY.geographyType) &&
    $CURRENT_INDICATOR_UID &&
    $CURRENT_SCENARIOS_UID?.some(s => SCENARIOS_IN_AVOIDING_IMPACTS.includes(s));

  // Build URL with current parameters
  $: projectUrl = isCompatible
    ? `/${PATH_PROJECTS}/avoiding-future-impact?indicator=${$CURRENT_INDICATOR_UID}&geography=${$CURRENT_GEOGRAPHY?.uid}`
    : null;
</script>

{#if isCompatible}
  <div class="mt-4 p-4 bg-surface-weaker rounded-lg">
    <p class="text-sm text-text-weaker mb-2">
      Want to explore impact avoidance scenarios for this indicator?
    </p>
    <a
      href={projectUrl}
      class="text-theme-base font-bold hover:underline inline-flex items-center gap-2"
    >
      View in Avoiding Future Impacts
      <span aria-hidden="true">→</span>
    </a>
  </div>
{/if}
```

### 2.8 Prerender Configuration Update

**File: `svelte.config.js`**

```javascript
// Add to prerender.entries array:
prerender: {
  handleMissingId: 'warn',
  entries: [
    '/',
    '/about',
    '/adaptation',
    '/contact',
    '/impacts/avoid',      // Keep for redirect
    '/impacts/explore',
    '/issues',
    '/keyconcepts',
    '/methodology',
    '/projects',           // Add
    '/projects/avoiding-future-impact',  // Add
    '/embed/impact-time',
    '/embed/impact-geo',
    '/embed/unavoidable-risk',
  ],
},
```

### 2.9 Store Updates for Project Context

**File: `src/stores/state.js`** (additions)

```javascript
// Add PATH_PROJECTS import
import {
  // ... existing imports
  PATH_PROJECTS,
} from '../config.js';

// Update IS_AVOID_PAGE to include project route
export const IS_AVOID_PAGE = derived(CURRENT_PAGE, ($currentPage) =>
  $currentPage === PATH_AVOID || $currentPage === 'avoiding-future-impact'
);
```

---

## 3. Phase 2: GeoServer + MVT Migration

### 3.1 Current Data Flow (Client-Side GeoJSON)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Data API      │────▶│  Client JS      │────▶│   Mapbox GL     │
│  (JSON/GeoJSON) │     │  Processing     │     │   Rendering     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Web Worker    │
                        │   geomask.js    │
                        │  (Turf.js clip) │
                        └─────────────────┘
```

**Current processing in `src/lib/utils/geo.js`:**
- `coordinatesToRectGrid()` - Grid data → GeoJSON polygons
- `coordinatesToContours()` - Grid data → D3 contours
- `getColorScale()` - D3 Lab color interpolation

### 3.2 Target Architecture (Server-Side MVT)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    PostGIS      │────▶│   GeoServer     │────▶│   Mapbox GL     │
│   Database      │     │  + GeoWebCache  │     │   Native MVT    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Vector Tiles   │
                        │     (MVT)       │
                        │  Pre-generated  │
                        └─────────────────┘
```

### 3.3 Environment Configuration

**File: `.env`**

```bash
# Existing
VITE_DATA_API_URL=...
VITE_MAPBOX_STYLE_LIGHT=...
VITE_MAPBOX_STYLE_SATELLITE=...
VITE_MAPBOX_STYLE_STUDY_LOCATIONS=...
VITE_MAPBOX_STYLE_GLOBE=...

# New GeoServer configuration
VITE_GEOSERVER_URL=https://geoserver.example.com/geoserver
VITE_GEOSERVER_WORKSPACE=provide
VITE_GEOSERVER_LAYER_BOUNDARIES=boundaries
VITE_GEOSERVER_LAYER_IMPACT_GRID=impact_grid
```

**File: `src/config.js`** (additions)

```javascript
// GeoServer configuration
export const GEOSERVER_URL = import.meta.env.VITE_GEOSERVER_URL;
export const GEOSERVER_WORKSPACE = import.meta.env.VITE_GEOSERVER_WORKSPACE;

// Layer name mappings
export const GEOSERVER_LAYERS = {
  boundaries: `${GEOSERVER_WORKSPACE}:boundaries`,
  impactGrid: `${GEOSERVER_WORKSPACE}:impact_grid`,
  cities: `${GEOSERVER_WORKSPACE}:cities`,
};

// MVT tile URL template
export const MVT_TILE_URL = (layer) =>
  `${GEOSERVER_URL}/gwc/service/tms/1.0.0/${layer}@EPSG:900913@pbf/{z}/{x}/{-y}.pbf`;
```

### 3.4 New VectorTileLayer Component

**File: `src/lib/MapboxMap/VectorTileLayer.svelte`**

```svelte
<script>
  import { getContext, onMount, onDestroy } from 'svelte';
  import { MVT_TILE_URL, GEOSERVER_LAYERS } from '$config';

  export let id;
  export let layer;           // GeoServer layer name
  export let sourceLayer;     // Source layer within the MVT
  export let type = 'fill';   // Mapbox layer type
  export let paint = {};      // Paint properties
  export let layout = {};     // Layout properties
  export let filter = null;   // Optional filter expression
  export let beforeId = null; // Layer ordering
  export let minzoom = 0;
  export let maxzoom = 14;

  const { getMap } = getContext('map');
  const map = getMap();

  const sourceId = `${id}-source`;

  onMount(() => {
    // Add vector tile source
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'vector',
        tiles: [MVT_TILE_URL(layer)],
        minzoom,
        maxzoom,
      });
    }

    // Add layer
    const layerConfig = {
      id,
      type,
      source: sourceId,
      'source-layer': sourceLayer,
      paint,
      layout,
    };

    if (filter) layerConfig.filter = filter;

    map.addLayer(layerConfig, beforeId);
  });

  onDestroy(() => {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  });

  // Reactive paint updates
  $: if (map.getLayer(id)) {
    Object.entries(paint).forEach(([prop, value]) => {
      map.setPaintProperty(id, prop, value);
    });
  }

  // Reactive filter updates
  $: if (map.getLayer(id) && filter) {
    map.setFilter(id, filter);
  }
</script>
```

### 3.5 Updated Maps Component

**File: `src/routes/(default)/impacts/explore/ImpactGeo/Maps.svelte`** (key changes)

```svelte
<script>
  import { GEOSERVER_LAYERS, GEOSERVER_URL } from '$config';
  import VectorTileLayer from '$lib/MapboxMap/VectorTileLayer.svelte';
  import MapProvider from '$lib/MapboxMap/MapProvider.svelte';

  // Props
  export let data;
  export let scenario;
  export let colorScale;

  // Build Mapbox style expression from color scale
  $: fillColorExpression = buildColorExpression(colorScale, data);

  function buildColorExpression(scale, data) {
    if (!scale || !data) return '#ccc';

    const { domain, range } = scale;
    const stops = domain.map((d, i) => [d, range[i]]);

    return [
      'interpolate',
      ['linear'],
      ['get', 'value'],  // Property from vector tile
      ...stops.flat()
    ];
  }

  // Build filter for current scenario/year
  $: layerFilter = [
    'all',
    ['==', ['get', 'scenario'], scenario.uid],
    ['==', ['get', 'year'], selectedYear],
  ];
</script>

<MapProvider>
  <VectorTileLayer
    id="impact-fill"
    layer={GEOSERVER_LAYERS.impactGrid}
    sourceLayer="impact_grid"
    type="fill"
    paint={{
      'fill-color': fillColorExpression,
      'fill-opacity': 0.85,
    }}
    filter={layerFilter}
  />

  <VectorTileLayer
    id="boundaries-line"
    layer={GEOSERVER_LAYERS.boundaries}
    sourceLayer="boundaries"
    type="line"
    paint={{
      'line-color': '#333',
      'line-width': 1,
    }}
  />
</MapProvider>
```

### 3.6 API Updates for GeoServer Metadata

**File: `src/lib/api/api.js`** (additions)

```javascript
import { GEOSERVER_URL, GEOSERVER_WORKSPACE } from '$config';

/**
 * Fetch GeoServer layer capabilities
 */
export async function getGeoServerCapabilities(layer) {
  const url = `${GEOSERVER_URL}/wms?service=WMS&version=1.1.1&request=GetCapabilities`;
  const response = await fetch(url);
  const text = await response.text();
  // Parse XML and extract layer info
  return parseCapabilities(text, layer);
}

/**
 * Fetch available values for a vector tile property
 */
export async function getVectorTilePropertyValues(layer, property) {
  const url = `${GEOSERVER_URL}/wfs?` + new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetPropertyValue',
    typeNames: layer,
    valueReference: property,
  });
  const response = await fetch(url);
  return response.json();
}

/**
 * Get feature info for clicked point
 */
export async function getFeatureInfo(layer, coordinates, zoom) {
  const [lng, lat] = coordinates;
  const url = `${GEOSERVER_URL}/wms?` + new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: layer,
    query_layers: layer,
    info_format: 'application/json',
    x: 128,
    y: 128,
    width: 256,
    height: 256,
    srs: 'EPSG:4326',
    bbox: calculateBBox(lng, lat, zoom),
  });
  const response = await fetch(url);
  return response.json();
}
```

### 3.7 Files to Remove/Deprecate

After MVT migration is complete:

```
src/lib/workers/geomask.js           # No longer needed
src/lib/utils/geo.js                 # Remove coordinatesToContours(),
                                     # coordinatesToRectGrid()
                                     # Keep getColorScale() and other utils
```

### 3.8 Migration Checklist

```
[ ] GeoServer Setup
    [ ] Deploy GeoServer instance
    [ ] Configure PostGIS connection
    [ ] Import boundary data
    [ ] Import gridded impact data
    [ ] Configure GeoWebCache for MVT
    [ ] Set up CORS for frontend access

[ ] Data Pipeline
    [ ] Create data ingestion scripts
    [ ] Define tile schemas (zoom levels, properties)
    [ ] Test tile generation
    [ ] Set up update automation

[ ] Frontend Updates
    [ ] Add VectorTileLayer component
    [ ] Update Maps.svelte
    [ ] Update ImpactGeo components
    [ ] Add GeoServer API utilities
    [ ] Update color scale handling
    [ ] Add feature interaction (hover, click)

[ ] Testing
    [ ] Test all zoom levels
    [ ] Test different scenarios/indicators
    [ ] Performance testing
    [ ] Cross-browser testing

[ ] Cleanup
    [ ] Remove unused GeoJSON processing code
    [ ] Remove web worker
    [ ] Update documentation
```

---

## 4. Phase 3: Case Studies Enhancement

### 4.1 Current Case Studies Structure

```
src/routes/(default)/adaptation/
├── +page.svelte              # Landing page
├── +page.server.js           # Loads from Strapi
├── sections/
│   ├── Outro.svelte
│   └── Publications.svelte
└── [city]/
    ├── +page.svelte          # Dynamic case study page
    ├── +page.server.js       # Loads case study data
    └── sections/
        ├── AvoidingImpacts.svelte
        ├── ExplorerLink.svelte
        ├── FutureImpacts.svelte
        └── ImageSlider.svelte
```

### 4.2 Strapi Schema Updates

**New Collection: `categories`**

```json
{
  "kind": "collectionType",
  "collectionName": "categories",
  "attributes": {
    "name": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "name" },
    "description": { "type": "text" },
    "color": { "type": "string" },
    "case_studies": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::case-study-dynamic.case-study-dynamic",
      "mappedBy": "categories"
    }
  }
}
```

**New Collection: `tags`**

```json
{
  "kind": "collectionType",
  "collectionName": "tags",
  "attributes": {
    "name": { "type": "string", "required": true },
    "slug": { "type": "uid", "targetField": "name" },
    "case_studies": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::case-study-dynamic.case-study-dynamic",
      "mappedBy": "tags"
    }
  }
}
```

**Updated: `case-study-dynamics`** (add relations)

```json
{
  // ... existing attributes
  "categories": {
    "type": "relation",
    "relation": "manyToMany",
    "target": "api::category.category",
    "inversedBy": "case_studies"
  },
  "tags": {
    "type": "relation",
    "relation": "manyToMany",
    "target": "api::tag.tag",
    "inversedBy": "case_studies"
  },
  "publishedAt": {
    "type": "datetime"
  }
}
```

### 4.3 Category & Tag Components

**File: `src/lib/helper/CategoryBadge.svelte`**

```svelte
<script>
  export let category;
  export let href = null;

  $: style = category.color ? `background-color: ${category.color}20; color: ${category.color}` : '';
</script>

<svelte:element
  this={href ? 'a' : 'span'}
  {href}
  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
  {style}
>
  {category.name}
</svelte:element>
```

**File: `src/lib/helper/TagChip.svelte`**

```svelte
<script>
  export let tag;
  export let href = null;
  export let selected = false;
</script>

<svelte:element
  this={href ? 'a' : 'span'}
  {href}
  class="inline-flex items-center px-3 py-1 rounded-md text-sm border transition-colors"
  class:bg-theme-base={selected}
  class:text-white={selected}
  class:border-contour-weaker={!selected}
  class:hover:border-theme-base={!selected}
>
  {tag.name}
</svelte:element>
```

### 4.4 Updated Adaptation Landing Page

**File: `src/routes/(default)/adaptation/+page.server.js`** (updated)

```javascript
import { loadFromStrapi } from '$utils/apis.js';
import { parse } from 'marked';

export const load = async ({ fetch, parent, url }) => {
  const { meta } = await parent();
  const { attributes } = await loadFromStrapi('adaptation', fetch);

  // Load case studies with categories and tags
  const caseStudiesRaw = await loadFromStrapi(
    'case-study-dynamics',
    fetch,
    'populate[categories]=*&populate[tags]=*'
  );

  // Load all categories and tags for filters
  const categoriesRaw = await loadFromStrapi('categories', fetch);
  const tagsRaw = await loadFromStrapi('tags', fetch);

  // Parse URL filters
  const selectedCategory = url.searchParams.get('category');
  const selectedTags = url.searchParams.get('tags')?.split(',').filter(Boolean) || [];

  // Process case studies
  let caseStudies = caseStudiesRaw.map((study) => ({
    city: meta.cities.find((d) => d.uid === study.attributes.CityUid) || { uid: study.attributes.CityUid, label: study.attributes.CityUid },
    abstract: study.attributes.Abstract,
    categories: study.attributes.categories?.data || [],
    tags: study.attributes.tags?.data || [],
    publishedAt: study.attributes.publishedAt,
    updatedAt: study.attributes.updatedAt,
  }));

  // Apply filters
  if (selectedCategory) {
    caseStudies = caseStudies.filter(cs =>
      cs.categories.some(c => c.attributes.slug === selectedCategory)
    );
  }
  if (selectedTags.length) {
    caseStudies = caseStudies.filter(cs =>
      selectedTags.every(tag => cs.tags.some(t => t.attributes.slug === tag))
    );
  }

  // Sort by date (most recent first)
  caseStudies.sort((a, b) =>
    new Date(b.publishedAt || b.updatedAt) - new Date(a.publishedAt || a.updatedAt)
  );

  // Get recent studies (top 5)
  const recentStudies = caseStudies.slice(0, 5);

  return {
    caseStudies,
    recentStudies,
    categories: categoriesRaw.map(c => c.attributes),
    tags: tagsRaw.map(t => t.attributes),
    selectedCategory,
    selectedTags,
    // ... rest of existing return values
  };
};
```

**File: `src/routes/(default)/adaptation/+page.svelte`** (updated sections)

```svelte
<script>
  import ContentPageLayout from '$src/lib/helper/ContentPages/ContentPageLayout.svelte';
  import CategoryBadge from '$lib/helper/CategoryBadge.svelte';
  import TagChip from '$lib/helper/TagChip.svelte';
  import { LABEL_ADAPTATION, PATH_ADAPTATION } from '$config';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  export let data;

  // Filter handling
  function toggleCategory(slug) {
    const url = new URL($page.url);
    if (data.selectedCategory === slug) {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', slug);
    }
    goto(url.toString(), { replaceState: true });
  }

  function toggleTag(slug) {
    const url = new URL($page.url);
    const tags = new Set(data.selectedTags);
    if (tags.has(slug)) {
      tags.delete(slug);
    } else {
      tags.add(slug);
    }
    if (tags.size) {
      url.searchParams.set('tags', [...tags].join(','));
    } else {
      url.searchParams.delete('tags');
    }
    goto(url.toString(), { replaceState: true });
  }
</script>

<!-- Add filters section -->
<div class="mb-8">
  <h3 class="text-sm font-bold uppercase tracking-wider text-text-weaker mb-3">Categories</h3>
  <div class="flex flex-wrap gap-2">
    {#each data.categories as category}
      <button on:click={() => toggleCategory(category.slug)}>
        <CategoryBadge
          {category}
          selected={data.selectedCategory === category.slug}
        />
      </button>
    {/each}
  </div>
</div>

<div class="mb-8">
  <h3 class="text-sm font-bold uppercase tracking-wider text-text-weaker mb-3">Topics</h3>
  <div class="flex flex-wrap gap-2">
    {#each data.tags as tag}
      <button on:click={() => toggleTag(tag.slug)}>
        <TagChip
          {tag}
          selected={data.selectedTags.includes(tag.slug)}
        />
      </button>
    {/each}
  </div>
</div>

<!-- Recent section -->
{#if data.recentStudies.length}
  <section class="mb-12">
    <h2 class="text-2xl font-bold mb-6">Recent Case Studies</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.recentStudies as study}
        <a href="/{PATH_ADAPTATION}/{study.city.uid}" class="group">
          <article class="bg-surface-weaker p-6 rounded-lg hover:shadow-md transition-shadow">
            <div class="flex gap-2 mb-3">
              {#each study.categories as cat}
                <CategoryBadge category={cat.attributes} />
              {/each}
            </div>
            <h3 class="font-bold text-lg group-hover:underline">{study.city.label}</h3>
            <p class="text-text-weaker mt-2 line-clamp-2">{study.abstract}</p>
            <time class="text-xs text-text-weakest mt-3 block">
              {new Date(study.publishedAt || study.updatedAt).toLocaleDateString()}
            </time>
          </article>
        </a>
      {/each}
    </div>
  </section>
{/if}
```

### 4.5 New Visualization Components

**Generic Component Template for Strapi Dynamic Zones:**

```svelte
<!-- Template: src/routes/(default)/adaptation/[city]/sections/GenericVisualization.svelte -->
<script>
  export let title;
  export let data;
  export let type; // 'table', 'chart', 'timeline', etc.
</script>

<section class="my-12">
  <h3 class="text-xl font-bold mb-4">{title}</h3>

  {#if type === 'data-table'}
    <DataTable {data} />
  {:else if type === 'comparison-chart'}
    <ComparisonChart {data} />
  {:else if type === 'timeline'}
    <Timeline {data} />
  {:else if type === 'stat-cards'}
    <StatCards {data} />
  {/if}
</section>
```

**File: `src/routes/(default)/adaptation/[city]/sections/DataTable.svelte`**

```svelte
<script>
  export let title = '';
  export let description = '';
  export let columns = [];
  export let rows = [];
  export let sortable = false;

  let sortColumn = null;
  let sortDirection = 'asc';

  $: sortedRows = sortable && sortColumn
    ? [...rows].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        const dir = sortDirection === 'asc' ? 1 : -1;
        return aVal > bVal ? dir : -dir;
      })
    : rows;

  function handleSort(column) {
    if (!sortable) return;
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
</script>

<div class="overflow-x-auto">
  {#if title}
    <h4 class="text-lg font-bold mb-2">{title}</h4>
  {/if}
  {#if description}
    <p class="text-text-weaker mb-4">{description}</p>
  {/if}

  <table class="min-w-full divide-y divide-contour-weaker">
    <thead class="bg-surface-weaker">
      <tr>
        {#each columns as column}
          <th
            class="px-4 py-3 text-left text-xs font-medium text-text-weaker uppercase tracking-wider"
            class:cursor-pointer={sortable}
            on:click={() => handleSort(column.key)}
          >
            {column.label}
            {#if sortable && sortColumn === column.key}
              <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-contour-weakest">
      {#each sortedRows as row}
        <tr>
          {#each columns as column}
            <td class="px-4 py-4 whitespace-nowrap text-sm">
              {row[column.key]}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

**File: `src/routes/(default)/adaptation/[city]/sections/StatCards.svelte`**

```svelte
<script>
  export let title = '';
  export let stats = [];
</script>

<div>
  {#if title}
    <h4 class="text-lg font-bold mb-4">{title}</h4>
  {/if}

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    {#each stats as stat}
      <div class="bg-surface-weaker rounded-lg p-4">
        <dt class="text-sm text-text-weaker">{stat.label}</dt>
        <dd class="mt-1 flex items-baseline gap-2">
          <span class="text-2xl font-bold">{stat.value}</span>
          {#if stat.unit}
            <span class="text-sm text-text-weaker">{stat.unit}</span>
          {/if}
        </dd>
        {#if stat.trend}
          <div class="mt-1 text-xs" class:text-green-600={stat.trend > 0} class:text-red-600={stat.trend < 0}>
            {stat.trend > 0 ? '↑' : '↓'} {Math.abs(stat.trend)}%
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
```

### 4.6 Case Study Page Server Handler Updates

**File: `src/routes/(default)/adaptation/[city]/+page.server.js`** (component handler additions)

```javascript
// Add to the component processing switch statement:

case 'data-table.data-table':
  return {
    type,
    title: c.Title,
    description: c.Description,
    columns: c.Columns?.map(col => ({ key: col.Key, label: col.Label })) || [],
    rows: c.Rows?.map(row => row.Data) || [],
    sortable: c.Sortable || false,
  };

case 'stat-cards.stat-cards':
  return {
    type,
    title: c.Title,
    stats: c.Stats?.map(stat => ({
      label: stat.Label,
      value: stat.Value,
      unit: stat.Unit,
      trend: stat.Trend,
    })) || [],
  };

case 'timeline.timeline':
  return {
    type,
    title: c.Title,
    events: c.Events?.map(event => ({
      date: event.Date,
      title: event.Title,
      description: event.Description,
    })) || [],
  };

case 'comparison-chart.comparison-chart':
  return {
    type,
    title: c.Title,
    chartType: c.ChartType, // 'bar' | 'line'
    series: c.Series?.map(s => ({
      name: s.Name,
      data: s.Data,
      color: s.Color,
    })) || [],
    labels: c.Labels || [],
  };

case 'embed-map.embed-map':
  return {
    type,
    title: c.Title,
    embedUrl: c.EmbedUrl,
    height: c.Height || 400,
    attribution: c.Attribution,
  };
```

---

## 5. Implementation Checklist

### Phase 1: Projects Hub (Priority: High)

```
[ ] Configuration
    [ ] Add PATH_PROJECTS, LABEL_PROJECTS to config.js
    [ ] Add PROJECTS array to config.js
    [ ] Update svelte.config.js prerender entries

[ ] Routes
    [ ] Create /projects/+page.svelte (landing)
    [ ] Create /projects/+page.server.js
    [ ] Create /projects/avoiding-future-impact/+layout.svelte
    [ ] Create /projects/avoiding-future-impact/+page.svelte
    [ ] Create /projects/avoiding-future-impact/+page.server.js
    [ ] Update /impacts/avoid/+page.server.js (redirect)

[ ] Navigation
    [ ] Update Header.svelte with Projects link
    [ ] Add project thumbnail to /static/images/projects/

[ ] Deep Linking
    [ ] Create LinkSection.svelte for explore page
    [ ] Add compatibility check logic
    [ ] Integrate into ImpactGeo section

[ ] Store Updates
    [ ] Update IS_AVOID_PAGE derived store
    [ ] Test URL parameter persistence

[ ] Testing
    [ ] Test navigation flow
    [ ] Test backward compatibility redirect
    [ ] Test deep linking conditions
    [ ] Test URL parameter passing
```

### Phase 2: GeoServer Migration (Priority: Medium)

```
[ ] Infrastructure
    [ ] Provision GeoServer instance
    [ ] Configure PostGIS database
    [ ] Set up GeoWebCache
    [ ] Configure CORS

[ ] Data Migration
    [ ] Import boundary geometries
    [ ] Import gridded impact data
    [ ] Create tile caching rules
    [ ] Test tile generation

[ ] Frontend Components
    [ ] Create VectorTileLayer.svelte
    [ ] Update DataSource.svelte
    [ ] Create GeoServer API utilities
    [ ] Update Maps.svelte

[ ] Styling Migration
    [ ] Convert D3 color scales to Mapbox expressions
    [ ] Implement feature state management
    [ ] Add hover/click interactions

[ ] Cleanup
    [ ] Remove geomask.js worker
    [ ] Remove unused geo.js functions
    [ ] Update documentation
```

### Phase 3: Case Studies Enhancement (Priority: Medium)

```
[ ] Strapi Updates
    [ ] Create categories collection
    [ ] Create tags collection
    [ ] Add relations to case-study-dynamics
    [ ] Add publishedAt field if missing
    [ ] Create new visualization components

[ ] Frontend - Filters
    [ ] Create CategoryBadge.svelte
    [ ] Create TagChip.svelte
    [ ] Update adaptation/+page.server.js
    [ ] Update adaptation/+page.svelte
    [ ] Add URL-based filtering

[ ] Frontend - Recent Section
    [ ] Add date sorting logic
    [ ] Create Recent section component
    [ ] Add date display to cards

[ ] Frontend - Visualizations
    [ ] Create DataTable.svelte
    [ ] Create StatCards.svelte
    [ ] Create Timeline.svelte
    [ ] Create ComparisonChart.svelte
    [ ] Create EmbedMap.svelte
    [ ] Update page.server.js handlers
```

---

## Appendix A: File Changes Summary

| File | Action | Phase |
|------|--------|-------|
| `src/config.js` | Modify | 1, 2 |
| `svelte.config.js` | Modify | 1 |
| `src/lib/site/Header.svelte` | Modify | 1 |
| `src/stores/state.js` | Modify | 1 |
| `src/routes/(default)/projects/+page.svelte` | Create | 1 |
| `src/routes/(default)/projects/+page.server.js` | Create | 1 |
| `src/routes/(default)/projects/avoiding-future-impact/+layout.svelte` | Create | 1 |
| `src/routes/(default)/projects/avoiding-future-impact/+page.svelte` | Create | 1 |
| `src/routes/(default)/projects/avoiding-future-impact/+page.server.js` | Create | 1 |
| `src/routes/(default)/impacts/avoid/+page.server.js` | Modify | 1 |
| `src/routes/(default)/impacts/explore/ImpactGeo/LinkSection.svelte` | Create | 1 |
| `src/lib/MapboxMap/VectorTileLayer.svelte` | Create | 2 |
| `src/lib/api/api.js` | Modify | 2 |
| `src/routes/(default)/impacts/explore/ImpactGeo/Maps.svelte` | Modify | 2 |
| `src/lib/utils/geo.js` | Modify | 2 |
| `src/lib/workers/geomask.js` | Remove | 2 |
| `src/lib/helper/CategoryBadge.svelte` | Create | 3 |
| `src/lib/helper/TagChip.svelte` | Create | 3 |
| `src/routes/(default)/adaptation/+page.svelte` | Modify | 3 |
| `src/routes/(default)/adaptation/+page.server.js` | Modify | 3 |
| `src/routes/(default)/adaptation/[city]/+page.server.js` | Modify | 3 |
| `src/routes/(default)/adaptation/[city]/sections/DataTable.svelte` | Create | 3 |
| `src/routes/(default)/adaptation/[city]/sections/StatCards.svelte` | Create | 3 |

---

## Appendix B: Dependencies

No new npm dependencies required for Phase 1 and 3.

Phase 2 (GeoServer) may require:
- GeoServer 2.23+ with GeoWebCache extension
- PostGIS 3.x database
- Server infrastructure for tile hosting

---

## Appendix C: Questions for Stakeholders

### GeoServer Migration
1. Is there an existing GeoServer instance available?
2. What hosting environment will be used?
3. What is the expected data update frequency?
4. What zoom levels are required for vector tiles?

### Projects Hub
1. What other projects are planned beyond "Avoiding Future Impacts"?
2. Should projects have their own navigation submenu?
3. Any specific design requirements for project cards?

### Case Studies
1. Which visualization components should be prioritized?
2. What category/topic taxonomy should be pre-defined?
3. Should "Recent" show by creation date or last update date?
4. Expected maximum number of case studies (pagination needs)?
