<script>
  export let sections = [];
  export let activeIndex = 0;
  // role="link" -> https://www.scottohara.me/blog/2021/05/28/disabled-links.html
</script>

{#each sections as section, i}
  {#if section.slug}
  {@const { slug, title, description, disabled } = section}
  {@const isActive = activeIndex === i}
  <a
    class:cursor-not-allowed={disabled}
    class:opacity-50={disabled}
    class:pointer-events-none={disabled}
    role={disabled ? 'link' : undefined}
    href={disabled ? undefined : `#${slug}`}
    class="md:inline-block py-3 pl-2 -ml-2 pr-12 border-r-3 hover:bg-surface-weaker"
    class:border-r-theme-base={isActive}
    class:border-r-transparent={!isActive}
    aria-current={isActive ? 'step' : 'false'}
  >
    <div class="font-semibold mb-1 -mt-1 leading-tight" class:text-theme-base={isActive && !disabled}>
      {title}
    </div>
    <div class="text-contour-weak leading-tight text-sm -mb-1" class:text-theme-weaker={isActive && !disabled}>
      {description}
    </div>
  </a>
  {/if}
{/each}
