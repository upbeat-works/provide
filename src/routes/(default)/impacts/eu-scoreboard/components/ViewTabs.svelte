<script>
  import { page } from '$app/stores';
  import { CLASS_SCOREBOARD_TEXT } from '$config';

  export let items = [];

  $: pathname = ($page.url?.pathname ?? '').replace(/\/$/, '');
  $: tabContext = { url: $page.url, data: $page.data };

  function tabHref(href, context) {
    const target = new URL(href, context.url);
    const params = new URLSearchParams(context.url.searchParams);
    const sector = context.data?.scoreboard?.sector?.uid;
    if (sector) params.set('sector', sector);
    for (const key of ['indicator', 'scenario', 'region', 'year']) {
      const uid = context.data?.selection?.[key]?.uid;
      if (uid) params.set(key, uid);
    }
    target.search = params.toString();
    return `${target.pathname}${target.search}`;
  }
</script>

<nav aria-label="Scoreboard views" class="inline-flex gap-1 rounded-sm border border-white/50 p-1">
  {#each items as { href, label }}
    {@const isActive = pathname === href}
    <a
      href={tabHref(href, tabContext)}
      aria-current={isActive ? 'page' : undefined}
      class="rounded-sm px-5 py-2 text-sm font-semibold transition-colors {isActive ? `bg-white ${CLASS_SCOREBOARD_TEXT}` : 'text-white hover:bg-white/10'}"
    >
      {label}
    </a>
  {/each}
</nav>
