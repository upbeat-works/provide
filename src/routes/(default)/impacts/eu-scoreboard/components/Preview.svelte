<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { encodePreview, decodePreview } from '../preview.js';
  import { createScoreboardOptions, resolveSelection } from '../selection.js';
  import { loadResource } from './resource.js';
  import CopyLink from '$lib/components/ui/CopyLink.svelte';

  export let data;
  let mounted = false;
  let editor = false;
  let text = '';
  let error = '';
  let busy = false;
  let preview;
  let shown;
  let revision = 0;
  let request = 0;
  let seen;
  let appliedHash;

  onMount(() => { mounted = true; });
  onDestroy(() => { request += 1; });
  $: if (!preview) shown = data;
  $: if (mounted) sync($page.url.hash, $page.url.search);

  function topicOf(scoreboard) {
    return { label: scoreboard.sector.label, map: scoreboard.map, charts: scoreboard.charts };
  }

  async function sync(hash, search) {
    const key = `${hash}${search}`;
    if (key === seen) return;
    seen = key;
    const token = ++request;
    if (hash === '#preview') {
      busy = false;
      editor = true;
      error = '';
      text = JSON.stringify(preview ?? topicOf(data.scoreboard), null, 2);
      return;
    }
    editor = false;
    if (!hash.startsWith('#preview=')) {
      preview = undefined;
      appliedHash = undefined;
      error = '';
      busy = false;
      return;
    }
    busy = true;
    error = '';
    try {
      const draft = await decodePreview(hash.slice('#preview='.length));
      const next = await buildPreview(draft, search);
      if (token !== request) return;
      preview = draft;
      shown = next;
      if (appliedHash !== hash) revision += 1;
      appliedHash = hash;
    } catch (reason) {
      if (token === request) error = reason.message;
    } finally {
      if (token === request) busy = false;
    }
  }

  async function buildPreview(draft, search) {
    const requested = Object.fromEntries(new URLSearchParams(search));
    const scoreboard = await loadResource('definition', 'preview', { indicator: { uid: requested.indicator } }, fetch, { preview: draft });
    const options = createScoreboardOptions(scoreboard, data.scenarioLabels);
    const selection = resolveSelection(scoreboard, options, requested);
    const load = (resource) => loadResource(resource, 'preview', selection, fetch, { preview: draft });
    let map;
    if (scoreboard.indicator) map = load('map').catch(() => ({ status: 'error', values: [], error: 'Map data could not be loaded.' }));
    const charts = scoreboard.charts.map((definition) => ({
      definition,
      result: load(`charts/${encodeURIComponent(definition.chartId)}`).catch(() => ({ definition, status: 'error', data: [], error: 'Chart data could not be loaded.' })),
    }));
    return { ...data, ...options, scoreboard, selection, map, charts };
  }

  async function apply() {
    const token = ++request;
    busy = true;
    error = '';
    try {
      const draft = JSON.parse(text);
      await loadResource('definition', 'preview', {}, fetch, { preview: draft });
      const encoded = await encodePreview(draft);
      if (token !== request) return;
      const url = new URL($page.url);
      url.hash = `preview=${encoded}`;
      await goto(url, { keepFocus: true, noScroll: true });
    } catch (reason) {
      if (token === request) error = reason.message;
    } finally {
      if (token === request) busy = false;
    }
  }

  function closeEditor() {
    const url = new URL($page.url);
    url.hash = appliedHash ?? '';
    void goto(url, { keepFocus: true, noScroll: true });
  }

  function keepPreviewHash(node) {
    function follow(event) {
      const link = event.target.closest('a');
      const href = link?.getAttribute('href');
      if (!preview || !href?.startsWith('#') || href.startsWith('#preview')) return;
      event.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    }
    node.addEventListener('click', follow);
    return { destroy: () => node.removeEventListener('click', follow) };
  }

  function reserveToolbarSpace(node) {
    const root = document.documentElement;
    const resize = () => root.style.setProperty('--scoreboard-preview-height', `${node.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    return { destroy() { observer.disconnect(); root.style.removeProperty('--scoreboard-preview-height'); } };
  }

  function openDialog(node) {
    node.showModal();
  }
</script>

{#if editor}
  <dialog use:openDialog on:cancel|preventDefault={closeEditor} aria-labelledby="preview-title" class="w-[min(48rem,90vw)] rounded-lg bg-white p-6 shadow-xl backdrop:bg-black/40">
    <form on:submit|preventDefault={apply}>
      <h2 id="preview-title" class="mb-4 text-xl font-bold">Preview scoreboard JSON</h2>
      <label for="preview-json" class="mb-2 block font-semibold">Topic JSON</label>
      <textarea id="preview-json" bind:value={text} spellcheck="false" rows="18" class="w-full rounded border border-gray-400 p-3 font-mono text-sm" />
      {#if error}<p role="alert" class="mt-3 text-red-700">{error}</p>{/if}
      <div class="mt-4 flex gap-4">
        <button type="submit" disabled={busy} class="rounded bg-theme-base px-4 py-2 font-bold text-white">{busy ? 'Checking…' : 'Preview'}</button>
        <button type="button" on:click={closeEditor}>Cancel</button>
      </div>
    </form>
  </dialog>
{/if}

{#if preview || busy || (error && !editor)}
  <aside aria-label="JSON preview" use:reserveToolbarSpace class="fixed inset-x-0 top-0 z-[60] border-b border-petrol-800 bg-petrol-900 font-sans text-white shadow-lg">
    <div class="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
      <div class="flex min-w-0 items-center gap-3">
        <span class="shrink-0 text-xs font-normal text-petrol-200">Preview</span>
        {#if preview}<strong class="truncate text-sm font-medium leading-5" title={preview.label}>{preview.label}</strong>{/if}
      </div>
      <nav aria-label="Preview actions" class="flex shrink-0 items-center gap-1 text-sm font-medium leading-5">
        <a href="#preview" class="rounded bg-white px-2.5 py-1 text-petrol-900 hover:bg-petrol-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol-300">Edit JSON</a>
        {#if preview}
          <CopyLink label="Copy link" className="flex items-center gap-2 rounded px-2.5 py-1 text-sm font-medium leading-5 text-white hover:bg-petrol-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol-300" />
        {/if}
        <a href={`${$page.url.pathname}${$page.url.search}`} class="ml-1 rounded px-2.5 py-1 text-petrol-200 hover:bg-petrol-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol-300">Exit preview</a>
      </nav>
    </div>
    {#if busy || (error && !editor)}
      <div class="border-t border-petrol-800">
        <div class="mx-auto max-w-screen-2xl px-4 py-2 text-sm leading-5 sm:px-6">
          {#if busy}<p role="status" class="text-petrol-200">Loading preview…</p>{/if}
          {#if error && !editor}<p role="alert" class="text-gold-200">{error}{preview ? ' Showing the last valid preview.' : ''}</p>{/if}
        </div>
      </div>
    {/if}
  </aside>
{/if}

{#if shown && (!($page.url.hash.startsWith('#preview=')) || preview)}
  <div use:keepPreviewHash><slot {shown} {preview} {revision} /></div>
{/if}
