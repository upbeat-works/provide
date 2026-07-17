<script>
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';

  export let href;
  export let label = 'View in explorer';
</script>

<Button {href} class="self-start whitespace-nowrap flex-shrink-0">
  {label}
  <LinkArrow />
</Button>
