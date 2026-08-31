<script>
  // One outline glyph per geography type, for the nested type rows in the
  // geography tree. Unknown types fall back to a map pin rather than a gap.
  let clazz = '';
  export { clazz as class };
  export let type;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={clazz}
  aria-hidden="true"
  role="presentation"
>
  {#if type === 'cities'}
    <path d="M3 21h18" />
    <path d="M5 21V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15" />
    <path d="M13 10h5a1 1 0 0 1 1 1v10" />
    <path d="M8 8.5h2M8 12h2M8 15.5h2M16 14h1M16 17.5h1" />
  {:else if type === 'river_basins'}
    <path d="M2 8c2.1-2 4.2-2 6.3 0s4.2 2 6.3 0 4.2-2 6.3 0" />
    <path d="M2 12c2.1-2 4.2-2 6.3 0s4.2 2 6.3 0 4.2-2 6.3 0" />
    <path d="M2 16c2.1-2 4.2-2 6.3 0s4.2 2 6.3 0 4.2-2 6.3 0" />
  {:else if type === 'eez'}
    <circle cx="12" cy="5" r="2.2" />
    <path d="M12 7.2V21" />
    <path d="M8.5 10.5h7" />
    <path d="M4.5 13.5a7.5 7.5 0 0 0 15 0" />
    <path d="M4.5 13.5H7M19.5 13.5H17" />
  {:else if type === 'glacier_regions'}
    <path d="M2 20 7.5 11l2.5 3.5L14.5 5.5 22 20z" />
    <path d="M12.6 9.6 14 12l1.6-1 1.7 2.6" />
  {:else if type === 'northern_latitudes'}
    <circle cx="12" cy="12" r="9" />
    <path d="M3.4 9h17.2M3.4 15h17.2" />
    <path d="M12 3c2.2 2.6 3.3 5.6 3.3 9s-1.1 6.4-3.3 9c-2.2-2.6-3.3-5.6-3.3-9s1.1-6.4 3.3-9z" />
  {:else if type === 'macroeconomies'}
    <path d="M3 7.5 9 4.5l6 3 6-3v12l-6 3-6-3-6 3z" />
    <path d="M9 4.5v12M15 7.5v12" />
  {:else}
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.4" />
  {/if}
</svg>
