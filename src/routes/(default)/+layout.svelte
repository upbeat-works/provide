<script>
  import '$styles/app.postcss';
  import 'tippy.js/dist/svg-arrow.css';
  import ThemeProvider from '$styles/ThemeProvider.svelte';
  import Header from '$lib/components/site/Header.svelte';
  import HtmlHead from '$lib/components/site/HtmlHead.svelte';
  import Footer from '$lib/components/site/Footer.svelte';
  import _ from 'lodash-es';
  import { CURRENT_PAGE } from '$stores/state';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { createScrollRestoration } from '$lib/utils/scrollRestoration';
  export let data;

  // The div below is what scrolls, not the document, so SvelteKit's window-based scroll
  // restoration never fires. Drive it against the container instead.
  let scrollEl;
  let restoration;

  // Safe for the initial 'enter' navigation: SvelteKit dispatches it after the root
  // component has fully mounted, so `scrollEl` is already bound.
  onMount(() => {
    restoration = createScrollRestoration(scrollEl);
    return () => restoration.destroy();
  });

  afterNavigate((nav) => restoration?.handle(nav));

  page.subscribe((v) => {
    if (v.hasOwnProperty('url') && 'pathname' in v.url) {
      const path = v.url.pathname.split('/');
      CURRENT_PAGE.set(path[path.length - 1]); // /explore/avoid -> avoid
    }
  });

  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g,
    evaluate: /\{\{=(.+?)\}\}/g,
  };
</script>

<HtmlHead />

<ThemeProvider theme="light">
  <div class="grid grid-rows-[auto_1fr_auto] h-screen flex-col">
    <Header />
    <div bind:this={scrollEl} class="relative overflow-y-auto scroll-smooth motion-reduce:scroll-auto">
      <main>
        <slot />
      </main>
      <Footer buildDate={data.buildDate} />
    </div>
  </div>
</ThemeProvider>
