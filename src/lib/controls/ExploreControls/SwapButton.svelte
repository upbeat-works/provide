<script>
  import { createEventDispatcher } from 'svelte';
  import Swap from '$lib/helper/icons/Swap.svelte';

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('click');
  }
</script>

<button
  type="button"
  on:click={handleClick}
  class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-weaker transition-colors text-theme-base"
  aria-label="Swap selection order"
>
  <Swap />
</button>
