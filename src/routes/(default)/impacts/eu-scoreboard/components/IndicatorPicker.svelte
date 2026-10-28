<script>
  import { createEventDispatcher } from 'svelte';
  import { RadioGroup, RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import Fuse from 'fuse.js';
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import SearchInput from '$lib/components/ui/SearchInput.svelte';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { layerInfo } from './layer-info.js';

  // The filter bar's indicator choice, laid out like Explore's indicator modal:
  // a searchable list, a detail panel for the hovered row, and an Apply footer.
  // Explore's own control (IndicatorSelection) is bound to the catalog stores;
  // the scoreboard's choice lives in the URL, so it only dispatches `change`.
  // A scoreboard indicator has no curated description — the panel shows what
  // its definition says about the layer, the same rows as the legend's info.
  export let label = 'Indicator';
  export let options = [];
  export let selected = undefined;
  export let definitions = [];
  export let wrapperClass = 'min-w-[10rem]';
  export let buttonClass = 'mt-1 text-sm';
  export let labelClass = '';

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let staged;
  $: if (!isOpen) staged = selected?.uid;

  let term = '';
  let listBox;
  // A new search starts the list from the top. The sidebar column is what
  // scrolls, so it is the list's parent that is reset.
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

  let hovered = null;
  // Hold the last hovered row so the panel does not blank as the pointer
  // crosses the gap between rows (InteractiveListItem clears on mouseleave).
  let lastHovered = null;
  $: if (hovered) lastHovered = hovered;
  $: stagedOption = options.find(({ uid }) => uid === staged);
  $: detailsUid = hovered ?? lastHovered ?? staged;
  $: details = options.find(({ uid }) => uid === detailsUid);
  $: rows = details ? layerInfo({ definition: definitions.find(({ name }) => name === details.uid) }).rows : [];
  $: changed = isOpen && Boolean(staged) && staged !== selected?.uid;

  function apply() {
    if (!stagedOption) return;
    isOpen = false;
    term = '';
    dispatch('change', stagedOption);
  }
</script>

<SelectionModal
  {label}
  buttonLabel={selected?.label ?? 'No data'}
  buttonAriaLabel="{label}: {selected?.label ?? 'none'}"
  {wrapperClass}
  {buttonClass}
  {labelClass}
  bind:isOpen
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <SearchInput bind:value={term} placeholder="Search indicators" />
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <span class="block px-5 pt-4 pb-2 text-xs uppercase tracking-widest text-text-weaker">Indicators</span>
      <div bind:this={listBox}>
        <RadioGroup bind:value={staged}>
          {#each matches as { uid, label } (uid)}
            <RadioGroupOption value={uid} let:checked>
              <InteractiveListItem {uid} {label} bind:hovered selected={checked} />
            </RadioGroupOption>
          {:else}
            <span class="text-xs py-1 px-5 block text-text-weaker" role="status">No indicators found.</span>
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
      {:else}
        No indicator selected yet
      {/if}
    </p>
    {#if changed}
      <Button variant="primary" class="shrink-0" on:click={apply}>Apply</Button>
    {/if}
  </div>
</SelectionModal>
