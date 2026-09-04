<script>
  // The colour ramp under a map panel's heading, shared by the ranking and
  // indicator views so the two legends can't drift apart. One swatch per class,
  // not a gradient: the map is a step choropleth, so a country is in a class
  // rather than somewhere along a continuum, and the legend should say so.
  // Scale literals rather than tokens: the scoreboard's ramps aren't in
  // color-tokens-light.json.
  export let scale = [];
  export let labels = [];
</script>

<div class="flex flex-col gap-1.5">
  <div class="flex h-2 w-full gap-0.5">
    {#each scale as color}
      <div class="h-full flex-1 rounded-[1px]" style="background-color: {color}" />
    {/each}
  </div>
  <div class="flex text-[11px] text-text-weaker">
    {#each labels as label}
      <span class="flex-1 text-center">{label}</span>
    {/each}
  </div>
</div>
