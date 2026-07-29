<script>
  import PillGroup from '$lib/components/ui/PillGroup.svelte';
  import PopoverButton from '$lib/components/ui/PopoverButton.svelte';
  import { stringify } from 'qs';
  import { writable } from 'svelte/store';
  import { browser } from '$app/environment';

  export let params;
  export let options = [];
  export let endpoint;
  // Which API serves this chart's data. Charts migrated to the Hono adapter pass
  // VITE_API_URL (and `repeat` array params, which is what it reads); the ones
  // still on the legacy Climate Analytics API keep the defaults.
  export let base = import.meta.env.VITE_DATA_API_URL;
  export let arrayFormat = 'indices';

  // Ignore params with no options (e.g. no scenarios selected yet) so we never
  // dereference an empty options list.
  $: validOptions = (options ?? []).filter((param) => param.options?.length);

  $: selectedParams = writable(
    validOptions.reduce(
      (memo, param) => ({
        ...memo,
        [param.uid]: param.options[0].uid,
      }),
      {}
    )
  );

  $: queryParameters = { ...params, ...$selectedParams };
  $: query = stringify(queryParameters, { encodeValuesOnly: true, arrayFormat });
  // `base` is only absolute for the legacy API. Behind the single-origin nginx
  // (docker dev AND prod) VITE_API_URL is the relative `/api`, which `new URL()`
  // rejects on its own — it threw during init and took the whole figcaption
  // (both download menus, every chart) down with it. Resolve against the page
  // origin; an absolute base ignores it. No origin during SSR, so pass the
  // relative href straight through — it is valid in markup either way.
  $: href = `${base}/${endpoint}/?${query}`;
  $: url = browser ? new URL(href, window.location.origin).href : href;

  $: maxVersions = validOptions.reduce((memo, param) => param.options.length * memo, 1);
</script>

{#if maxVersions > 1}
  <PopoverButton label="Download data">
    <div class="max-w-xs px-3 py-3 flex gap-y-4 flex-col">
      <div class="flex gap-y-2 flex-col">
        {#each validOptions as param}
          <div class="grid pt-2 grid-cols-7 gap-2 border-t items-start border-contour-weakest first:border-none">
            <span class="leading-none col-span-2 text-contour-weak text-sm py-1.5">{param.label}</span>
            <div class="col-span-5 col-start-3">
              {#if param.options.length > 1}
                <PillGroup size="sm" allowWrap={true} options={param.options} bind:currentUid={$selectedParams[param.uid]} />
              {:else}
                <span class="text-sm py-1.5 leading-none px-3 bg-theme-base text-surface-base font-bold rounded-full">{param.options[0].label}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <a href={url} class="text-center bg-petrol-800 text-white hover:bg-petrol-900 disabled:text-theme-weaker w-full py-2 text-sm px-3" download>Download data</a>
    </div>
  </PopoverButton>
{:else}
  <a href={url} class="text-theme-base font-bold text-sm flex hover:text-theme-stronger" download>Download data</a>
{/if}
