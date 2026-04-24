<script>
  import {
    PATH_KEY_CONCEPTS,
    LABEL_KEY_CONCEPTS,
    LABEL_EXPLORE,
    PATH_EXPLORE,
    PATH_IMPACT,
    LABEL_DOCUMENTATION,
    LABEL_CONTACT,
    LABEL_ABOUT,
    PATH_ABOUT,
    PATH_CONTACT,
    PATH_DOCUMENTATION,
    PATH_CASE_STUDIES,
    LABEL_CASE_STUDIES,
  } from '$config';
  import NavLink from '$lib/components/navigation/NavLink.svelte';
  import Logo from './Logo.svelte';
  import { HEADER_CLASS } from '$stores/state';

  const items = [
    { href: `/${PATH_IMPACT}/${PATH_EXPLORE}`, label: LABEL_EXPLORE },
    { href: `/${PATH_CASE_STUDIES}`, label: LABEL_CASE_STUDIES },
    { href: `/${PATH_DOCUMENTATION}`, label: LABEL_DOCUMENTATION },
    { href: `/${PATH_KEY_CONCEPTS}`, label: LABEL_KEY_CONCEPTS },
    { href: `/${PATH_ABOUT}`, label: LABEL_ABOUT },
    { href: `/${PATH_CONTACT}`, label: LABEL_CONTACT },
  ];
</script>

<nav class={`py-4 border-b border-dashed ${$HEADER_CLASS || 'bg-sky-700 border-sky-600'}`}>
  <div class="mx-auto max-w-7xl px-6 flex justify-between items-center gap-y-4 flex-col lg:flex-row">
    <NavLink href="/" class="hover:text-sky-100 transition-colors"><Logo /></NavLink>
    <ul class="flex flex-wrap gap-x-6 lg:gap-x-8">
      {#each items as { label, href }}
        <NavLink
          activeClass="text-white font-medium"
          class="text-white hover:text-sky-100 text-sm md:text-base transition-colors"
          {href}>{label}</NavLink
        >
      {/each}
    </ul>
  </div>
</nav>
