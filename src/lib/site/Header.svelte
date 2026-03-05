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
    PATH_ADAPTATION,
    LABEL_ADAPTATION,
  } from '$config';
  import NavLink from '$lib/helper/NavLink.svelte';
  import Logo from './Logo.svelte';

  const items = [
    { href: `/${PATH_EXPLORE}/${PATH_IMPACT}`, label: LABEL_EXPLORE },
    { href: `/${PATH_ADAPTATION}`, label: LABEL_ADAPTATION },
    { href: `/${PATH_DOCUMENTATION}`, label: LABEL_DOCUMENTATION },
    { href: `/${PATH_KEY_CONCEPTS}`, label: LABEL_KEY_CONCEPTS },
    { href: `/${PATH_ABOUT}`, label: LABEL_ABOUT },
    { href: `/${PATH_CONTACT}`, label: LABEL_CONTACT },
  ];
</script>

<nav class="bg-sky-700 fixed top-0 left-0 right-0 z-50">
  <div class="mx-auto w-full max-w-7xl h-[70px] px-8 lg:px-0 flex justify-between items-center">
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
