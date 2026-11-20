import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('./shared', import.meta.url)),
        fileURLToPath(new URL('./api/scoreboard', import.meta.url)),
        fileURLToPath(new URL('./api/db/import/country-iso3.ts', import.meta.url)),
        fileURLToPath(new URL('./api/conventions.ts', import.meta.url)),
      ],
    },
  },
  worker: { format: 'es' },
  optimizeDeps: {
    include: [
      '@floating-ui/dom',
      '@internationalized/date',
      '@mapbox/mapbox-gl-sync-move',
      '@melt-ui/svelte',
      '@popperjs/core',
      '@rgossiaux/svelte-headlessui',
      '@tanstack/query-core',
      '@tanstack/query-persist-client-core',
      '@turf/bbox',
      '@turf/centroid',
      '@turf/difference',
      '@turf/helpers',
      '@turf/intersect',
      '@turf/mask',
      'copy-to-clipboard',
      'd3-array',
      'd3-color',
      'd3-contour',
      'd3-dsv',
      'd3-force',
      'd3-format',
      'd3-geo',
      'd3-geo-projection',
      'd3-interpolate',
      'd3-scale',
      'd3-shape',
      'dequal',
      'file-saver',
      'focus-trap',
      'fuse.js',
      'geotiff',
      'idb-keyval',
      'layercake',
      'lodash-es',
      'mapbox-gl',
      'microlighter',
      'nanoid',
      'qs',
      'svelte-popperjs',
      'tippy.js',
    ],
  },
};

export default config;
