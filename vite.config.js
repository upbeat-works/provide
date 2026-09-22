import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('./api/scoreboard', import.meta.url)),
        fileURLToPath(new URL('./api/db/import/country-iso3.ts', import.meta.url)),
        fileURLToPath(new URL('./api/conventions.ts', import.meta.url)),
      ],
    },
  },
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['copy-to-clipboard', 'd3-scale', '@turf/bbox', '@turf/centroid', '@turf/difference', '@turf/helpers', '@turf/intersect', '@turf/mask'],
  },
};

export default config;
