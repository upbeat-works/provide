<script>
  import AsyncContent from './AsyncContent.svelte';
  import Scenarios from './Scenarios/Scenarios.svelte';
  export let promise;
</script>

<AsyncContent {promise} let:value>
  <Scenarios scenarios={value.scenarios} selectableTimeframes={value.selectableTimeframes} defaultTimeframe={value.defaultTimeframe} scenarioPresets={value.scenarioPresets} />
</AsyncContent>
