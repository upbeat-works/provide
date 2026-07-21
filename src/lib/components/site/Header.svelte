<script>
  import {
    LABEL_EXPLORE,
    PATH_EXPLORE,
    PATH_IMPACT,
    PATH_AVOID,
    LABEL_DOCUMENTATION,
    LABEL_CONTACT,
    LABEL_ABOUT,
    PATH_ABOUT,
    PATH_CONTACT,
    PATH_DOCUMENTATION,
    PATH_ADAPTATION,
    LABEL_ADAPTATION,
    LABEL_TOOLS,
    LABEL_AVOID_IMPACTS,
  } from '$config';
  import NavLink from '$lib/components/navigation/NavLink.svelte';
  import Logo from './Logo.svelte';
  import { HEADER_CLASS } from '$stores/state';

  const itemsBeforeTools = [{ href: `/${PATH_IMPACT}/${PATH_EXPLORE}`, label: LABEL_EXPLORE }];

  const itemsAfterTools = [
    { href: `/${PATH_ADAPTATION}`, label: LABEL_ADAPTATION },
    { href: `/${PATH_DOCUMENTATION}`, label: LABEL_DOCUMENTATION },
    { href: `/${PATH_ABOUT}`, label: LABEL_ABOUT },
    { href: `/${PATH_CONTACT}`, label: LABEL_CONTACT },
  ];

  const toolsMenu = {
    label: LABEL_TOOLS,
    options: [{ href: `/${PATH_IMPACT}/${PATH_AVOID}`, label: LABEL_AVOID_IMPACTS }],
  };

  const navLinkClass =
    'text-white hover:text-sky-100 text-[14px] font-semibold leading-[150%] transition-colors';
</script>

<nav class={`py-4 border-b border-dashed ${$HEADER_CLASS || 'bg-sky-700 border-sky-600'}`}>
  <div class="mx-auto max-w-7xl px-6 flex justify-between items-center gap-y-4 flex-col lg:flex-row">
    <NavLink href="/" class="hover:text-sky-100 transition-colors"><Logo /></NavLink>
    <ul class="flex flex-wrap gap-x-6 lg:gap-x-8 items-center">
      {#each itemsBeforeTools as { label, href }}
        <NavLink
          activeClass="text-white font-medium"
          class={navLinkClass}
          {href}>{label}</NavLink
        >
      {/each}
      <li class="relative group">
        <button type="button" class={`${navLinkClass} cursor-pointer`} aria-haspopup="true">
          {toolsMenu.label}
        </button>
        <ul
          class="invisible absolute z-10 top-full left-0 pt-[10px] opacity-0 pointer-events-none transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
        >
          <div class="flex flex-col items-stretch bg-surface-base shadow-xl">
            {#each toolsMenu.options as option}
              <li>
                <NavLink
                  href={option.href}
                  class="px-4 py-2 hover:bg-surface-weaker text-sm text-theme-base whitespace-nowrap block"
                  >{option.label}</NavLink
                >
              </li>
            {/each}
          </div>
        </ul>
      </li>
      {#each itemsAfterTools as { label, href }}
        <NavLink
          activeClass="text-white font-medium"
          class={navLinkClass}
          {href}>{label}</NavLink
        >
      {/each}
    </ul>
  </div>
</nav>
