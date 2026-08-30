<script>
  // The colour ramp under a map panel's heading, shared by the ranking and
  // indicator views so the two legends can't drift apart. Scale literals rather
  // than tokens: the scoreboard's ramps aren't in color-tokens-light.json.
  export let scale = [];
  export let labels = [];
</script>

<div class="flex flex-col gap-1.5">
  <div class="h-1.5 w-full rounded-sm" style="background: linear-gradient(to right, {scale.join(', ')})" />
  <div class="flex justify-between text-[11px] text-text-weaker">
    {#each labels as label}
      <span>{label}</span>
    {/each}
  </div>
</div>
