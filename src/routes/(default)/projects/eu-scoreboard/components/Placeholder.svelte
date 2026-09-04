<script>
  // Stand-in for a chart/map that has no endpoint yet. Purely visual — delete
  // the usage once the real component lands.
  export let label;
  export let height = 'h-72';
  let className = '';
  export { className as class };
</script>

<div class="flex items-center justify-center rounded border border-dashed border-contour-weakest bg-surface-weaker text-sm text-text-weaker {height} {className}">
  {label}
</div>
