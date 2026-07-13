import { preprocessMeltUI } from '@melt-ui/pp';
import sequence from 'svelte-sequential-preprocessor';
import preprocess from 'svelte-preprocess';
import adapterNetlify from '@sveltejs/adapter-netlify';
import adapterStatic from '@sveltejs/adapter-static';
const isStatic = process.env.BUILD_ENV === 'static';
const adapter = isStatic ? adapterStatic : adapterNetlify;
console.log(`Using ${isStatic ? 'static' : 'netlify'} adapter.`);
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
    adapter: adapter(),
    version: {
      name: process.env.npm_package_version,
    },
    prerender: {
      handleMissingId: 'warn',
      // Fail the build for our own broken routes (referrer is unset for our explicit `entries`
      // below), but only warn when the broken link was discovered while crawling - e.g. a stale
      // URL inside CMS-authored markdown content, which we don't fully control.
      handleHttpError: ({ path, referrer, message }) => {
        if (!referrer) {
          throw new Error(message);
        }
        console.warn(`${message} (linked from ${referrer})`);
      },
      entries: [
        '/',
        '/about',
        '/case-studies',
        '/keyconcepts',
        '/contact',
        '/impacts/avoid',
        '/impacts/explore',
        '/issues',
        '/methodology/key-terms',
        '/methodology',
        '/embed/impact-time',
        '/embed/impact-geo',
        '/embed/unavoidable-risk',
        '/projects/provide',
      ],
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
