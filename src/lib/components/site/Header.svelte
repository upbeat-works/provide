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
    LABEL_AVOID_IMPACTS_NAV,
  } from '$config';
  import NavLink from '$lib/components/navigation/NavLink.svelte';
  import NavDropdown from '$lib/components/navigation/NavDropdown.svelte';
  import Logo from './Logo.svelte';
  import { HEADER_CLASS } from '$stores/state';
  import { page } from '$app/stores';

  // Per-route header themes. Derived from the current route (not set on mount)
  // so the correct colors are already present during SSR and the first client
  // render — this avoids the default→project-theme flash on pages like /impacts/avoid.
  // `menuText` matches the nav background colour so the Tools dropdown options
  // (on a white panel) are tinted to the current page's theme. Dashed border uses
  // petrol-400 (#6FA5BA) per the design; the tool pages (avoid, provide) share one theme.
  const HEADER_THEME_DEFAULT = { bg: 'bg-sky-700', border: 'border-petrol-400', menuText: 'text-sky-700' };
  const HEADER_THEME_TOOL = { bg: 'bg-[#1C4157]', border: 'border-petrol-800/50', menuText: 'text-[#1C4157]' };

  function getHeaderTheme(pathname = '') {
    if (pathname.startsWith(`/${PATH_IMPACT}/${PATH_AVOID}`)) return HEADER_THEME_TOOL;
    if (pathname.startsWith('/projects/provide')) return HEADER_THEME_TOOL;
    return HEADER_THEME_DEFAULT;
  }

  $: theme = getHeaderTheme($page.url?.pathname);
  // `$HEADER_CLASS` stays available as an explicit override; otherwise fall back
  // to the route-derived theme.
  $: headerClass = $HEADER_CLASS || `${theme.bg} ${theme.border}`;

  const items = [
    { href: `/${PATH_IMPACT}/${PATH_EXPLORE}`, label: LABEL_EXPLORE },
    {
      label: LABEL_TOOLS,
      submenu: [{ href: `/${PATH_IMPACT}/${PATH_AVOID}`, label: LABEL_AVOID_IMPACTS_NAV }],
    },
    { href: `/${PATH_ADAPTATION}`, label: LABEL_ADAPTATION },
    { href: `/${PATH_DOCUMENTATION}`, label: LABEL_DOCUMENTATION },
    { href: `/${PATH_ABOUT}`, label: LABEL_ABOUT },
    { href: `/${PATH_CONTACT}`, label: LABEL_CONTACT },
  ];
</script>

<nav class={`relative z-50 py-4 border-b border-dashed ${headerClass}`}>
  <div class="mx-auto max-w-7xl px-6 flex justify-between items-center gap-y-4 flex-col lg:flex-row">
    <NavLink href="/" class="hover:text-sky-100 transition-colors"><Logo /></NavLink>
    <ul class="flex flex-wrap items-center gap-x-6 lg:gap-x-8">
      {#each items as { label, href, submenu }}
        {#if submenu}
          <NavDropdown {label} items={submenu} textClass={theme.menuText} />
        {:else}
          <NavLink
            activeClass="text-white font-medium"
            class="text-white hover:text-sky-100 text-[14px] font-semibold leading-[150%] transition-colors"
            {href}>{label}</NavLink
          >
        {/if}
      {/each}
    </ul>
  </div>
</nav>
