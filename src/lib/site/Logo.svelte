<script>
  import { TITLE_PROJECT, TITLE_SITE } from '$config';

  export let size = 'md';
  export let color = 'white';

  $: sizeClasses = {
    sm: 'gap-2 text-sm',
    md: 'gap-3 text-md',
  }[size];

  $: colorClass = `text-${color}`;
</script>

<div class="inline-flex {sizeClasses}">
  <h1 class="{colorClass} font-bold uppercase tracking-widest">
    {TITLE_PROJECT}
  </h1>
  <span class="{colorClass}" role="presentation" aria-hidden="true"
    >|</span
  >
  <span class="{colorClass}">{TITLE_SITE}</span>
</div>
