<script>
  // The colour ramp under a map panel's heading, shared by the ranking and
  // indicator views so the two legends can't drift apart. One swatch per class,
  // not a gradient: the map is a step choropleth, so a country is in a class
  // rather than somewhere along a continuum, and a gradient would blend through
  // colours the map never paints.
  // Scale literals rather than tokens: the scoreboard's ramps aren't in
  // color-tokens-light.json.
  export let scale = [];
  export let labels = [];
</script>

<div class="flex flex-col gap-2">
  <!-- Butted together, not spaced: the classes partition one range, and a gap
       between them reads as a gap in the data. Square ends, no rounding — the
       ramp is a measured axis, not a pill. -->
  <div class="flex h-3.5 w-full">
    {#each scale as color}
      <div class="h-full flex-1" style="background-color: {color}" />
    {/each}
  </div>
  <div class="flex text-xs text-theme-stronger">
    {#each labels as label}
      <span class="flex-1 text-center">{label}</span>
    {/each}
  </div>
</div>
