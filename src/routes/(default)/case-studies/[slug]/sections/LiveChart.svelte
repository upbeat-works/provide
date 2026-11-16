<script>
  import { onDestroy, onMount } from 'svelte';
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';
  import ExplorerLink from './ExplorerLink.svelte';

  export let title = undefined;
  export let description = undefined;
  export let embedUrl;
  export let explorerUrl = undefined;

  // Before the chart reports its size. Charts render at roughly this height.
  const INITIAL_HEIGHT = 520;

  let height = INITIAL_HEIGHT;
  let observer;
  let frame;

  // The embed page is same-origin, so its document can be measured directly and
  // the frame grows with the chart (selectors, legends, loading states).
  function fitToContent() {
    observer?.disconnect();
    const doc = frame?.contentDocument;
    // `.embed` wraps the chart on the embed page; the document itself never
    // reports less than the frame's current height, so it could only grow.
    const content = doc?.querySelector('.embed');
    if (!content) return;
    const measure = () => {
      const next = Math.ceil(content.getBoundingClientRect().height);
      if (next > 0) height = next;
    };
    measure();
    observer = new ResizeObserver(measure);
    observer.observe(content);
  }

  // A server-rendered frame can finish loading before this component hydrates,
  // in which case its load event has already fired.
  onMount(() => {
    if (frame?.contentDocument?.readyState === 'complete') fitToContent();
  });
  onDestroy(() => observer?.disconnect());
</script>

{#if title}
  <h4 class="text-xl font-bold mb-7">{title}</h4>
{/if}

<figure class="max-w-3xl">
  <iframe
    bind:this={frame}
    src={embedUrl}
    title={title ?? 'Interactive chart'}
    loading="lazy"
    class="w-full border-0 block"
    style:height="{height}px"
    on:load={fitToContent}
  />
  {#if description || explorerUrl}
    <figcaption class="flex flex-col items-start gap-6 mt-4">
      {#if description}
        <div class="text-sm text-text-weaker max-w-[40em]"><HtmlContent content={description} /></div>
      {/if}
      <ExplorerLink href={explorerUrl} />
    </figcaption>
  {/if}
</figure>
