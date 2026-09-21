import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

// Runner for the Svelte component and page tests under `src/` (the API suite is
// `bun test api/`). The SvelteKit plugin is deliberately not used: it wants a
// dev server and a route manifest, and these tests render components directly.
// That means `$app/*` has no implementation here, so a test that reaches it
// mocks it (`vi.mock('$app/navigation', …)`), the way the existing ones do.
// Each test file calls testing-library's `cleanup()` itself, so no auto-cleanup
// plugin is wired up here.
const src = (path) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));
const stub = (name) => fileURLToPath(new URL(`./test/stubs/${name}.js`, import.meta.url));

function vitestFiles(dir = 'src', found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) vitestFiles(path, found);
    // Route directories are named `(default)` and `[embed]`, which `include`
    // would otherwise read as glob syntax rather than as literal path segments.
    else if (/\.(test|spec)\.(js|ts)$/.test(entry.name) && /from ['"]vitest['"]/.test(readFileSync(path, 'utf8'))) found.push(path.replace(/[()[\]{}!*?]/g, '\\$&'));
  }
  return found;
}

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      // SvelteKit's ambient modules have no implementation outside a running
      // app; these keep them importable. Tests that assert on them mock them.
      '$app/navigation': stub('app-navigation'),
      '$app/environment': stub('app-environment'),
      '$app/stores': stub('app-stores'),
      $src: src(''),
      $config: src('config.js'),
      $styles: src('styles'),
      $lib: src('lib'),
      $utils: src('lib/utils'),
      $stores: src('stores'),
      $helper: src('lib/helper'),
      $routes: src('routes'),
      $workers: src('lib/workers'),
      $formatting: src('lib/utils/formatting.js'),
    },
    // Components must resolve to the same Svelte instance the test renders with.
    conditions: ['browser'],
  },
  test: {
    // jsdom for everything that renders, node for the SSR tests: those spin up a
    // real vite server, and jsdom's TextEncoder breaks esbuild's Uint8Array
    // invariant.
    environment: 'jsdom',
    environmentMatchGlobs: [['**/*.ssr.test.js', 'node']],
    // `src/` holds two test dialects: most files are vitest, fourteen are
    // `bun:test` and belong to `bun test`. Vitest cannot resolve `bun:test`, so
    // it runs only the files that actually ask for it.
    include: vitestFiles(),
    globals: false,
    // The SSR tests boot a vite server of their own, which does not always fit
    // in the 5s default.
    testTimeout: 30000,
  },
});
