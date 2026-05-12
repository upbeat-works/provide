<script>
  export let selected = false;
  export let color = 'petrol';
  export let count = undefined;

  const colorClasses = {
    petrol: {
      selected:   'bg-petrol-700 border-petrol-700 text-white',
      unselected: 'bg-petrol-50 border-petrol-200 text-petrol-700',
      count:      'text-petrol-400',
    },
    grass: {
      selected:   'bg-grass-700 border-grass-700 text-white',
      unselected: 'bg-grass-50 border-grass-200 text-grass-700',
      count:      'text-grass-400',
    },
    pink: {
      selected:   'bg-pink-700 border-pink-700 text-white',
      unselected: 'bg-pink-50 border-pink-200 text-pink-700',
      count:      'text-pink-400',
    },
    orange: {
      selected:   'bg-orange-700 border-orange-700 text-white',
      unselected: 'bg-orange-50 border-orange-200 text-orange-700',
      count:      'text-orange-400',
    },
    sky: {
      selected:   'bg-sky-700 border-sky-700 text-white',
      unselected: 'bg-sky-50 border-sky-200 text-sky-700',
      count:      'text-sky-400',
    },
    gray: {
      selected:   'bg-gray-600 border-gray-600 text-white',
      unselected: 'bg-gray-50 border-gray-200 text-gray-700',
      count:      'text-gray-400',
    },
  };

  $: c = colorClasses[color] ?? colorClasses.petrol;
</script>

<button
  class="flex items-center gap-1 py-1 px-3 text-xs leading-tight border rounded-full transition-colors whitespace-nowrap {selected ? c.selected : c.unselected}"
  on:click
>
  <slot />
  {#if count !== undefined}
    <small class="font-normal {selected ? '' : c.count}">{count}</small>
  {/if}
</button>
