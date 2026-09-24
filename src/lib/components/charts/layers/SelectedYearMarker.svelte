<script>
  import { getContext } from 'svelte';

  export let year;

  const { xScale, height } = getContext('LayerCake');

  $: domain = $xScale.domain();
  $: withinDomain = Number.isFinite(year) && domain.length >= 2 && year >= Math.min(...domain) && year <= Math.max(...domain);
  $: position = withinDomain ? $xScale(year) : undefined;
</script>

{#if Number.isFinite(position)}
  <g role="img" aria-label={`Selected year ${year}`} transform={`translate(${position}, 0)`}>
    <line x1="0" x2="0" y1="0" y2={$height} stroke="#454a4c" stroke-width="2" stroke-dasharray="4 4" />
  </g>
{/if}
