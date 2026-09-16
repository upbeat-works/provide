<script>
  import { page } from '$app/stores';
  import { CLASS_SCOREBOARD_TEXT } from '$config';

  export let items = [];

  $: pathname = ($page.url?.pathname ?? '').replace(/\/$/, '');

  function viewHref(href) {
    const params = new URLSearchParams();
    params.set('sector', $page.data.scoreboard.sector.uid);
    for (const key of ['scenario', 'region', 'year']) {
      const value = $page.data.selection?.[key]?.uid ?? $page.url.searchParams.get(key);
      if (value) params.set(key, value);
    }
    return `${href}?${params}`;
  }
</script>

<nav aria-label="Scoreboard views" class="inline-flex gap-1 rounded-sm border border-white/50 p-1">
  {#each items as { href, label }}
    {@const isActive = pathname === href}
    <a
      href={viewHref(href)}
      aria-current={isActive ? 'page' : undefined}
      class="rounded-sm px-5 py-2 text-sm font-semibold transition-colors {isActive ? `bg-white ${CLASS_SCOREBOARD_TEXT}` : 'text-white hover:bg-white/10'}"
    >
      {label}
    </a>
  {/each}
</nav>
