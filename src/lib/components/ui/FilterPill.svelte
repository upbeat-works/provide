<script>
  export let selected = false;
  export let color = 'petrol';
  export let count = undefined;

  const colorClasses = {
    petrol: {
      selected:   'bg-petrol-700 border-petrol-700 text-white',
      unselected: 'bg-petrol-50 border-petrol-200 text-petrol-700',
      muted:      'bg-petrol-50 border-petrol-100 text-petrol-400',
      count:      'text-petrol-400',
    },
    grass: {
      selected:   'bg-grass-700 border-grass-700 text-white',
      unselected: 'bg-grass-50 border-grass-200 text-grass-700',
      muted:      'bg-grass-50 border-grass-100 text-grass-400',
      count:      'text-grass-400',
    },
    pink: {
      selected:   'bg-pink-700 border-pink-700 text-white',
      unselected: 'bg-pink-50 border-pink-200 text-pink-700',
      muted:      'bg-pink-50 border-pink-100 text-pink-400',
      count:      'text-pink-400',
    },
    orange: {
      selected:   'bg-orange-700 border-orange-700 text-white',
      unselected: 'bg-orange-50 border-orange-200 text-orange-700',
      muted:      'bg-orange-50 border-orange-100 text-orange-400',
      count:      'text-orange-400',
    },
    sky: {
      selected:   'bg-sky-700 border-sky-700 text-white',
      unselected: 'bg-sky-50 border-sky-200 text-sky-700',
      muted:      'bg-sky-50 border-sky-100 text-sky-400',
      count:      'text-sky-400',
    },
    gray: {
      selected:   'bg-gray-600 border-gray-600 text-white',
      unselected: 'bg-gray-50 border-gray-200 text-gray-700',
      muted:      'bg-gray-50 border-gray-100 text-gray-400',
      count:      'text-gray-400',
    },
  };

  // A chip with results shows its count and reads bold; one with none is muted
  // and shows no number at all. Selected takes the strong fill either way.
  // Chips given no count keep the plain tag styling other pages use.
  $: c = colorClasses[color] ?? colorClasses.petrol;
  $: isFacet = count !== undefined;
  $: hasResults = Number(count) > 0;
  $: tone = selected ? c.selected : isFacet && !hasResults ? c.muted : c.unselected;
  $: typography = !isFacet ? 'text-xs' : hasResults ? 'text-sm font-semibold' : 'text-sm font-normal';
</script>

<button
  class="flex items-center gap-1 py-1 px-3 leading-tight border rounded-full transition-colors whitespace-nowrap {typography} {tone} {$$props.class ?? ''}"
  on:click
>
  <slot />
  {#if hasResults}
    <span>{count}</span>
  {/if}
</button>
