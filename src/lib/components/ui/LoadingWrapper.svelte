<script>
  import { STATUS_FAILED, STATUS_SUCCESS } from '$src/config.js';
  import LoadingPlaceholder from '$lib/components/ui/LoadingPlaceholder.svelte';
  import Message from '$lib/components/ui/Message.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { each, filter } from 'lodash-es';

  export let props = {}; // Regular props/state that need to be kept in sync with the asyncProps
  export let asyncProps = {}; // Array or Dict of regular object that have a status property
  export let process = (d) => d; // Function for data processing before props are passed to slot
  export let isLoading; // true if no data or only partial data is loaded yet
  export let isFailed = false;
  export let warningSizeSmall = false;
  export let warningBackground = true;
  export let warningInverted = false;
  export let wrapperClass = undefined;
  export let retry = undefined;

  let currentProps;
  let currentAsyncProps; // Always holds previous props and only gets updated once all data is loaded

  function flattenData(datum, acc = []) {
    if (Array.isArray(datum) || !datum.status) {
      each(datum, (d) => flattenData(d, acc));
    } else {
      acc.push(datum);
    }
    return acc;
  }

  // Data can be passed as key value store, as array or simply as single data object
  $: flatData = flattenData(asyncProps);

  $: loadedData = filter(flatData, (d) => d.status === STATUS_SUCCESS);
  $: isFailed = !!filter(flatData, (d) => d.status === STATUS_FAILED).length;
  $: isExpectedFail = isFailed && !!filter(flatData, (d) => d.isExpected).length;

  $: if (loadedData.length !== flatData.length || !flatData.length) {
    isLoading = true;
  } else {
    isLoading = false;
  }

  $: if (!isLoading && !isFailed) {
    currentProps = props;
    currentAsyncProps = process
      ? { ...asyncProps, ...process(asyncProps, props) } // Make sure all props are part of the passed props, but allow for overwriting them
      : asyncProps;
  }
</script>

<div aria-busy={isLoading && !isFailed} class={wrapperClass}>
  {#if isFailed}
    <slot name="failed">
      <Message {warningBackground} {warningSizeSmall} {warningInverted} warningSign={!isExpectedFail} headline={isExpectedFail ? 'Graph not available' : 'Data could not be loaded for this graph'}>
        {#if isExpectedFail}
          {#if flatData.length}
            <div class="mt-4 flex flex-col">
              {#each flatData.filter(({ message }) => typeof message !== 'undefined') as { message }}<span>{message}</span>{/each}
            </div>
          {/if}
        {:else}
          <span>Try again in a moment.</span>
          {#if retry}
            <div class="mt-4"><Button variant="secondary" on:click={retry}>Retry</Button></div>
          {/if}
          {#if flatData.length}
            <div class="mt-4 font-mono text-xs text-text-weaker flex flex-col" class:text-white={warningInverted}>
              {#each flatData.filter(({ message }) => typeof message !== 'undefined') as { message }}<span>{message}</span>{/each}
            </div>
          {/if}
        {/if}
      </Message>
    </slot>
  {:else if isLoading}
    <slot name="placeholder">
      <LoadingPlaceholder />
    </slot>
  {:else}
    <slot {isLoading} asyncProps={currentAsyncProps} props={currentProps} />
  {/if}
</div>
