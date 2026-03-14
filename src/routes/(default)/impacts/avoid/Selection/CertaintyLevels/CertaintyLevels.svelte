<script>
  import Select from "$lib/controls/Select/Select.svelte";
  import { formatValue } from "$lib/utils/formatting";
  import { LIKELIHOODS } from "$stores/meta.js";
  import { SELECTED_LIKELIHOOD_LEVEL } from "$stores/avoid.js";

  $: options = $LIKELIHOODS.map(({ uid, value }) => ({
    uid,
    label: formatValue(value, "percent"),
  }));
</script>

<Select
  label="Probability"
  {options}
  value={$SELECTED_LIKELIHOOD_LEVEL}
  wrapperClass="flex-col border-r border-contour-weakest py-4 px-6"
  on:change={({ detail }) => SELECTED_LIKELIHOOD_LEVEL.set(detail.value)}
/>
