import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['copy-to-clipboard', 'd3-scale', '@turf/bbox', '@turf/centroid', '@turf/difference', '@turf/helpers', '@turf/intersect', '@turf/mask'],
  },
};

export default config;
