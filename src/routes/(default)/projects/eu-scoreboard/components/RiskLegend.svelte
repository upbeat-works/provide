<script>
  // The colour ramp under a map panel's heading, shared by the ranking and
  // indicator views so the two legends can't drift apart.
  // Scale literals rather than tokens: the scoreboard's ramps aren't in
  // color-tokens-light.json.
  export let scale = [];
  export let labels = [];

  // Drawn as one continuous ramp rather than a swatch per class. A single class
  // has no ramp to draw, so it fills flat.
  $: ramp = scale.length > 1 ? `linear-gradient(90deg, ${scale.join(', ')})` : (scale[0] ?? 'transparent');
</script>

<div class="flex flex-col gap-2">
  <!-- Square ends, full bleed: the ramp is a measured axis across the panel,
       not a pill sitting inside it. -->
  <div class="h-3.5 w-full" style="background: {ramp}" />
  <div class="flex text-xs text-theme-stronger">
    {#each labels as label}
      <span class="flex-1 text-center">{label}</span>
    {/each}
  </div>
</div>
