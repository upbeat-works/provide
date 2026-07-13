<script>
  import SelectionModal from '$lib/components/controls/components/SelectionModal.svelte';
  import SelectionPanel from '$lib/components/controls/components/SelectionPanel.svelte';
  import ScenarioOptionRow from './ScenarioOptionRow.svelte';
  import HtmlContent from '$lib/components/ui/HtmlContent.svelte';
  import Tagline from '$lib/components/ui/Tagline.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
  import THEME from '$styles/theme-store.js';
  import { PATH_KEY_CONCEPTS, ANCHOR_EXPLAINER_SCENARIOS, MAX_NUMBER_SELECTABLE_SCENARIOS } from '$config';
  import { parse } from 'marked';

  export let options = []; // [{ id, label, warmingCategory, description }]
  export let selected = []; // array of ids, bindable

  let hoveredId;

  const warmingCategories = [
    { uid: '1p5', label: 'Paris Agreement consistent up to 2050' },
    { uid: 'medium', label: 'Temperature rise above 1.5°C' },
    { uid: 'high', label: 'Temperature well above 1.5°C' },
  ];

  $: optionsByCategory = [
    ...warmingCategories.map((category) => ({ ...category, options: options.filter((o) => o.warmingCategory === category.uid) })),
    { uid: undefined, label: undefined, options: options.filter((o) => !warmingCategories.some((c) => c.uid === o.warmingCategory)) },
  ].filter((category) => category.options.length);

  $: hasSelection = selected.length > 0;
  $: multipleSelected = selected.length > 1;
  $: maxSelected = selected.length >= MAX_NUMBER_SELECTABLE_SCENARIOS;
  $: buttonLabel = !hasSelection ? 'ALL' : multipleSelected ? `${selected.length} scenarios selected` : options.find((o) => o.id === selected[0])?.label;

  // Colors aren't a property of a scenario - they're assigned by position within the current
  // selection, same as $CURRENT_SCENARIOS in stores/state.js, using the categorical palette.
  $: colors = hasSelection ? selected.map((_, i) => $THEME?.color?.category?.base?.[i]).filter(Boolean) : undefined;

  function toggle(id) {
    if (selected.includes(id)) {
      selected = selected.filter((d) => d !== id);
    } else if (!maxSelected) {
      selected = [...selected, id];
    }
  }

  $: highlighted = options.find((o) => o.id === (hoveredId ?? selected[0]));
</script>

<SelectionModal
  label="Scenario"
  {buttonLabel}
  {colors}
  labelClass="p-0 !font-bold"
  buttonClass="text-sm font-bold p-0 h-[24px] text-theme-base"
  wrapperClass="flex gap-2 font-normal transition-colors flex-col"
  panelClass="max-w-4xl"
>
  <SelectionPanel>
    <svelte:fragment slot="header">
      <div class="flex items-center justify-between">
        <span class="block text-xs uppercase tracking-widest text-theme-weaker">Pick one or more scenarios</span>
        <Button href={`/${PATH_KEY_CONCEPTS}#${ANCHOR_EXPLAINER_SCENARIOS}`}>
          Which scenario should I select?
          <LinkArrow />
        </Button>
      </div>
    </svelte:fragment>
    <svelte:fragment slot="sidebar">
      <fieldset class="flex flex-col min-w-min py-2">
        {#each optionsByCategory as category}
          {#if category.label}
            <Tagline class="px-4 mt-3 mb-2 text-wrap">{category.label}</Tagline>
          {/if}
          {#each category.options as option (option.id)}
            <ScenarioOptionRow
              {option}
              isSelected={selected.includes(option.id)}
              isDisabled={!selected.includes(option.id) && maxSelected}
              isHovered={hoveredId === option.id}
              onToggle={() => toggle(option.id)}
              onHover={() => (hoveredId = option.id)}
            />
          {/each}
        {/each}
        {#if !options.length}
          <p class="text-sm text-text-weaker px-4 py-2">No scenarios tagged yet</p>
        {/if}
      </fieldset>
    </svelte:fragment>
    <svelte:fragment slot="content">
      <div class="p-6 w-full">
        {#if highlighted}
          <h3 class="text-lg font-bold text-theme-800 mb-2">{highlighted.label}</h3>
          {#if highlighted.description}
            <HtmlContent content={parse(highlighted.description)} />
          {/if}
        {:else}
          <div class="p-4 flex items-center rounded text-contour-weak justify-center min-h-[40vh]">Hover over a scenario to view details</div>
        {/if}
      </div>
    </svelte:fragment>
  </SelectionPanel>
</SelectionModal>
