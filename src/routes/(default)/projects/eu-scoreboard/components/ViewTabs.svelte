<script>
  import { page } from '$app/stores';
  import { CLASS_SCOREBOARD_TEXT } from '$config';

  // Segmented switch between the scoreboard's two views, sitting in the hero.
  // Routes, not local state, so a view is linkable and survives a reload.
  export let items = [];

  // Exact match: the ranking view is the section root, so a prefix test would
  // leave it lit on every sub-view.
  $: pathname = ($page.url?.pathname ?? '').replace(/\/$/, '');
</script>

<nav aria-label="Scoreboard views" class="inline-flex gap-1 rounded-sm border border-white/50 p-1">
  {#each items as { href, label }}
    {@const isActive = pathname === href}
    <a
      {href}
      aria-current={isActive ? 'page' : undefined}
      class="rounded-sm px-5 py-2 text-sm font-semibold transition-colors {isActive ? `bg-white ${CLASS_SCOREBOARD_TEXT}` : 'text-white hover:bg-white/10'}"
    >
      {label}
    </a>
  {/each}
</nav>
