import { preprocessMeltUI } from '@melt-ui/pp';
import sequence from 'svelte-sequential-preprocessor';
import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-node';
/** @type {import('@sveltejs/kit').Config}*/
const config = {
  kit: {
    alias: {
      $src: 'src',
      $config: 'src/config.js',
      $styles: 'src/styles',
      $lib: 'src/lib',
      $utils: 'src/lib/utils',
      $stores: 'src/stores',
      $helper: 'src/lib/helper',
      $routes: 'src/routes',
      $workers: 'src/lib/workers',
      $formatting: 'src/lib/utils/formatting.js',
    },
    // Server-side rendering via a standalone Node server (`node build`), served
    // behind the nginx reverse proxy. No prerendering — pages render on demand.
    adapter: adapter(),
    version: {
      name: process.env.npm_package_version,
    },
  },
  preprocess: sequence([
    preprocess({
      postcss: true,
    }),
    preprocessMeltUI(),
  ]),
};
export default config;
