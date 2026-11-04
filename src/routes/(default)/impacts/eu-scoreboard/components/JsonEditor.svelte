<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import 'microlighter/themes/github.css';

  export let id;
  export let value = '';
  let mirror;
  let input;
  let highlight;
  let ready = false;
  let alive = true;

  onMount(() => {
    if (!globalThis.CSS?.highlights || !globalThis.Highlight) return;
    import('microlighter').then((module) => {
      if (alive) highlight = module.highlightAll;
    }).catch(() => {});
  });

  function clearHighlights() {
    for (const ranges of globalThis.CSS?.highlights?.values() ?? []) {
      for (const range of ranges) {
        if (mirror.contains(range.startContainer)) ranges.delete(range);
      }
    }
  }

  onDestroy(() => {
    alive = false;
    clearHighlights();
  });

  $: if (highlight) refresh(value);

  async function refresh(text) {
    await tick();
    if (!alive) return;
    try {
      await highlight({ root: mirror });
      if (alive) ready = true;
      else clearHighlights();
    } catch {
      ready = false;
    }
    if (alive) syncScroll();
  }

  function syncScroll() {
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
  }
</script>

<div class="json-editor" data-syntax-theme="github">
  <pre bind:this={mirror} aria-hidden="true"><code class="language-json">{value}{'\n'}</code></pre>
  <textarea {id} bind:this={input} bind:value class:highlighted={ready} on:scroll={syncScroll} spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" rows="18" />
</div>

<style>
  .json-editor {
    position: relative;
    overflow: hidden;
    border: 1px solid #9ca3af;
    border-radius: 0.25rem;
    background: white;
    color-scheme: light;
  }

  .json-editor:focus-within {
    outline: 2px solid #0550ae;
    outline-offset: 2px;
  }

  pre, textarea {
    margin: 0;
    border: 0;
    padding: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.875rem;
    line-height: 1.5rem;
    letter-spacing: normal;
    tab-size: 2;
    white-space: pre;
  }

  pre {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  code { font: inherit; }

  textarea {
    position: relative;
    display: block;
    width: 100%;
    resize: vertical;
    outline: none;
    background: white;
    color: #24292f;
    caret-color: #24292f;
  }

  textarea.highlighted {
    background: transparent;
    color: transparent;
  }

  textarea::selection {
    background: #b6d7ff;
    color: #24292f;
  }
</style>
