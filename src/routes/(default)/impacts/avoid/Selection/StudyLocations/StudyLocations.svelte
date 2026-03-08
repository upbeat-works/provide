<script>
  import Select from "$lib/controls/Select/Select.svelte";
  import { STUDY_LOCATIONS } from "$stores/meta.js";
  import { SELECTED_STUDY_LOCATION } from "$stores/avoid.js";
</script>

<Select
  label="Location"
  options={$STUDY_LOCATIONS}
  value={$SELECTED_STUDY_LOCATION}
  wrapperClass="flex-col border-r border-contour-weakest py-4"
  on:change={({ detail }) => SELECTED_STUDY_LOCATION.set(detail.value)}
/>
