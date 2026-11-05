<script>
  import { createEventDispatcher } from 'svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import Fuse from 'fuse.js';
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { layerInfo } from './layer-info.js';

  export let label = 'Indicator';
  export let topics = [];
  export let topic = undefined;
  export let selected = undefined;
  export let wrapperClass = 'min-w-[10rem]';
  export let buttonClass = 'mt-1 text-sm';
  export let labelClass = '';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let stagedTopicUid;
  let staged;
  let previewUid;
  $: if (!isOpen) {
    stagedTopicUid = topic?.uid;
    staged = selected?.uid;
    previewUid = undefined;
  }
  $: stagedTopic = topics.find(({ uid }) => uid === stagedTopicUid);
  $: definitions = stagedTopic?.indicators ?? [];
  $: options = definitions.map(({ name }) => ({ uid: name, label: name }));

  let term = '';
  let listBox;
  // The sidebar owns the scroll container.
  $: if (listBox?.parentElement) (term, (listBox.parentElement.scrollTop = 0));

  $: fuse = new Fuse(options, { keys: ['label', 'uid'], includeMatches: true });
  $: matches = !term.trim()
    ? options
    : fuse.search(term).map(({ item, matches }) => {
        let label = item.label;
        const match = matches?.find((m) => m.key === 'label');
        if (match) {
          label = '';
          for (let i = 0; i < match.indices.length; i++) {
            const [start, end] = match.indices[i];
            if (i === 0 && start !== 0) label += item.label.substring(0, start);
            label += `<mark>${item.label.substring(start, end + 1)}</mark>`;
            const nextStart = match.indices[i + 1]?.[0] ?? item.label.length;
            if (end !== item.label.length - 1) label += item.label.substring(end + 1, nextStart);
          }
        }
        return { ...item, label };
      });

  $: stagedOption = options.find(({ uid }) => uid === staged);
  $: details = options.find(({ uid }) => uid === previewUid) ?? stagedOption;
  $: rows = details ? layerInfo({ definition: definitions.find(({ name }) => name === details.uid) }).rows : [];
  $: changed = isOpen && stagedTopic && (stagedTopicUid !== topic?.uid || staged !== selected?.uid);
  $: canApply = changed && (stagedOption || !definitions.length);

  function pickTopic(next) {
    const previous = next.indicators.find(({ name }) => name === staged);
    stagedTopicUid = next.uid;
    staged = previous?.name ?? next.defaultIndicator;
    previewUid = undefined;
  }

  function apply() {
    if (!canApply) return;
    const choice = { topic: { uid: stagedTopic.uid, label: stagedTopic.label }, indicator: stagedOption };
    isOpen = false;
    term = '';
    dispatch('change', choice);
  }
</script>

<SelectionModal
  {label}
  buttonLabel={selected?.label ?? topic?.label ?? 'No data'}
  buttonAriaLabel="{label}: {selected?.label ?? topic?.label ?? 'none'}"
  category={selected ? topic?.label : undefined}
  {wrapperClass}
  {buttonClass}
  {labelClass}
  bind:isOpen
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search indicators" />
      <div class="mt-3 rounded-sm border border-theme-base/20 bg-surface-base/60 p-4" role="group" aria-label="Topic">
        <p class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-theme-base">
          <span class="h-2 w-2 rounded-full bg-theme-base" aria-hidden="true"></span>
          Topic
        </p>
        <div class="flex flex-wrap gap-2">
          {#each topics as item (item.uid)}
            <button
              type="button"
              aria-pressed={stagedTopicUid === item.uid}
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors {stagedTopicUid === item.uid ? 'border-theme-base bg-theme-base text-white' : 'border-theme-base/30 bg-surface-base text-theme-base hover:bg-theme-50'}"
              on:click={() => pickTopic(item)}
            >
              {item.label}<span class="font-normal opacity-70">{item.indicators.length}</span>
            </button>
          {/each}
        </div>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <div bind:this={listBox}>
        <RadioGroup bind:value={staged}>
          {#each matches as { uid, label } (uid)}
            <RadioGroupOption
              as="button"
              type="button"
              value={uid}
              aria-label={uid}
              title={uid}
              class="flex w-full px-5 py-1 text-left text-sm hover:bg-surface-weaker focus:bg-surface-weaker focus:outline-none border-theme-base {staged === uid ? 'text-theme-base border-r-3 bg-surface-weaker' : ''}"
              on:focus={() => (previewUid = uid)}
              on:mouseover={() => (previewUid = uid)}
            >
              <span class="truncate" class:font-bold={staged === uid}>{@html label}</span>
            </RadioGroupOption>
          {:else}
            <span class="text-xs py-1 px-5 block text-text-weaker" role="status">
              {#if definitions.length}No indicators found.{:else}No map indicators in this topic.{/if}
            </span>
          {/each}
        </RadioGroup>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="content">
      {#if details}
        <div class="p-8 min-w-0 w-full">
          <h3 class="font-bold mb-2 text-lg text-theme-stronger break-words">{details.label}</h3>
          {#if rows.length}
            <dl class="mt-4 grid grid-cols-1 gap-x-8 lg:grid-cols-2">
              {#each rows as { label, value }}
                <div class="border-t border-contour-weakest py-3">
                  <dt class="text-sm text-text-weaker">{label}</dt>
                  <dd class="mt-0.5 text-sm font-semibold text-theme-stronger break-words">{value}</dd>
                </div>
              {/each}
            </dl>
          {/if}
        </div>
      {/if}
    </svelte:fragment>
  </SelectionPanel>

  <div class="flex items-center justify-between gap-3 border-t border-contour-weakest bg-surface-base px-4 py-3">
    <p class="min-w-0 truncate text-sm text-text-weaker">
      {#if stagedOption}
        <span class="font-medium text-theme-base">{stagedOption.label}</span> selected
      {:else if stagedTopic}
        <span class="font-medium text-theme-base">{stagedTopic.label}</span> selected
      {:else}
        No indicator selected yet
      {/if}
    </p>
    {#if canApply}
      <Button variant="primary" class="shrink-0" on:click={apply}>Apply</Button>
    {/if}
  </div>
</SelectionModal>
