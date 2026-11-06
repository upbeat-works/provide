<script>
  import Indicators from './Indicators.svelte';
  import Preview from '../components/Preview.svelte';
  export let data;
</script>

<Preview {data} let:shown let:preview let:revision>
  {#key revision}
    <Indicators data={shown} {preview} />
  {/key}
</Preview>
