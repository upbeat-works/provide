<script>
  import { createEventDispatcher } from 'svelte';
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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.5 21L3 16.5M3 16.5L7.5 12M3 16.5H16.5M16.5 3L21 7.5M21 7.5L16.5 12M21 7.5H7.5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>
