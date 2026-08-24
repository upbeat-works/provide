<script>
  import copy from 'copy-to-clipboard';
  import tooltip from '$lib/utils/tooltip';
  import Link from '$lib/components/icons/Link.svelte';

  export let href = undefined;

  let copied = false;
  let resetTimeout;

  function handleClick() {
    copy(href ?? window.location.href);
    copied = true;
    clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      copied = false;
    }, 2000);
  }
</script>

<button
  class="flex items-center gap-x-2 text-left text-sm font-bold hover:bg-white rounded-xl transition-colors text-theme-base"
  on:click={handleClick}
  use:tooltip={{ content: copied ? 'Copied to clipboard!' : 'Click to copy the link to the clipboard' }}
>
  <Link class="h-4 w-4 flex-shrink-0" />
  {copied ? 'Copied!' : 'Copy link to these results'}
</button>
