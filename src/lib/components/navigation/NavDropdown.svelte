<script>
  import {
    Menu,
    MenuButton,
    MenuItems,
    MenuItem,
  } from '@rgossiaux/svelte-headlessui';
  import { createPopperActions } from 'svelte-popperjs';
  import { page } from '$app/stores';
  import { checkCurrentLink } from '$utils/url.js';
  import Chevron from '$lib/components/icons/Chevron.svelte';

  export let label;
  export let items = [];
  export let panelPlacement = 'bottom-start';
  // Text colour for the options, matching the nav background colour so the
  // dropdown stays tied to the current page's theme (the panel itself is white).
  export let textClass = 'text-sky-700';

  const [popperRef, popperContent] = createPopperActions();

  const popperOptions = {
    placement: panelPlacement,
    strategy: 'fixed',
    modifiers: [{ name: 'offset', options: { offset: [0, 10] } }],
  };

  // Highlight the trigger when the current page is one of the submenu links,
  // mirroring the active treatment of the sibling NavLinks in the header.
  $: isActive = items.some(({ href }) => checkCurrentLink(href, $page));
</script>

<Menu class="relative flex items-center">
  <MenuButton
    use={[popperRef]}
    let:open
    class={`flex items-center gap-1 text-white hover:text-sky-100 text-[14px] font-semibold leading-[150%] transition-colors ${isActive ? 'text-white font-medium' : ''}`}
  >
    <span>{label}</span>
    <span class="flex transition-transform duration-150" class:rotate-180={open}>
      <Chevron class="stroke-current" />
    </span>
  </MenuButton>

  <MenuItems
    use={[[popperContent, popperOptions]]}
    class="min-w-[13rem] rounded border border-contour-weakest bg-surface-base py-1 shadow-xl focus:outline-none"
  >
    {#each items as item}
      <MenuItem
        href={item.href}
        class="block focus:outline-none"
        aria-current={checkCurrentLink(item.href, $page) ? 'page' : undefined}
        let:active
      >
        <!--
          headlessui tracks an internal active index instead of moving DOM focus,
          so the highlight is driven by `active` (covers both pointer hover and
          keyboard arrow navigation). `active` is only exposed to slotted content,
          which is why the highlight lives on this child element rather than the
          MenuItem <a> itself. The block span fills the whole row so the entire
          link is the hover/click target.
        -->
        <span
          class={`block px-4 py-2 text-sm font-semibold transition-colors ${textClass} ${active ? 'bg-surface-weaker' : ''}`}
        >
          {item.label}
        </span>
      </MenuItem>
    {/each}
  </MenuItems>
</Menu>
