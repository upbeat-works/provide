<script>
  import { kebabCase } from 'lodash-es';
  export let title;
  export let subtitle;
  export let slug = undefined;

  $: id = slug ?? kebabCase(title);
</script>

<header class="flex flex-col gap-x-2 scroll-mt-4 mb-2 mt-4 first-of-type:mt-0" class:mb-4={subtitle} {id} name={id}>
  <h3 class="font-bold text-xl">{title}</h3>
  {#if subtitle}<span class="text-xs text-text-weaker">{subtitle}</span>{/if}
</header>
