<script>
  import ChartFrame from '../ChartFrame/ChartFrame.svelte';
  import Message from '../../ui/Message.svelte';
  import ChartRenderer from './ChartRenderer.svelte';
  import { ChartSchemaError, parseChartContract } from './contracts';

  export let definition;
  export let contract;
  export let actions = undefined;
  export let tagline = undefined;

  let checkedContract;
  let contractError;

  $: {
    try {
      checkedContract = parseChartContract(contract);
      contractError = undefined;
    } catch (cause) {
      if (!(cause instanceof ChartSchemaError)) {
        throw cause;
      }
      checkedContract = undefined;
      contractError = cause.message;
    }
  }

  $: formats = checkedContract?.meta.formats ?? [];
  $: dataDownloadOptions = formats.length
    ? [
        {
          uid: 'format',
          label: 'Format',
          options: formats.map((uid) => ({ uid, label: uid })),
        },
      ]
    : [];
  $: chartUid = actions?.uid ?? definition.id;
  $: actionParams = actions?.params;
</script>

<ChartFrame
  title={definition.title}
  description={definition.description}
  {tagline}
  {chartUid}
  chartInfo={checkedContract?.meta.info ?? []}
  dataDownloadParams={actionParams}
  {dataDownloadOptions}
  dataDownloadBase={actions?.base}
  dataDownloadArrayFormat={actions?.arrayFormat}
  graphDownloadParams={actionParams}
  templateProps={{}}
>
  {#if contractError}
    <Message headline="Chart data is not valid" warningSizeSmall={true}>{contractError}</Message>
  {:else}
    <ChartRenderer contract={checkedContract} />
  {/if}
</ChartFrame>
