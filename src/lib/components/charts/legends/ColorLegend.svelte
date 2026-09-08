<script>
  export let items;
  export let textSize = 'text-sm';
  // The swatch every item gets unless it names its own `variant`: a block of
  // colour for areas and bars, a stroke for lines (which are told apart by
  // their dash as much as by their colour), a dot for a plain note.
  export let variant = 'block';
  export let labelClass = 'font-bold';
</script>

<dl class="flex flex-wrap gap-x-4 {$$restProps.class}">
  {#each items as { label, color, uid, dash, variant: itemVariant }}
    {@const kind = itemVariant ?? variant}
    <!-- For some reason the updating of the color causes issues if no key block is added -->
    {#key uid}
      <div class="flex gap-x-1.5 items-center" id={uid}>
        <dt>
          {#if kind === 'line'}
            <svg width="26" height="14" aria-hidden="true" class="block overflow-visible">
              <title>{label}</title>
              <line x1="0" x2="26" y1="7" y2="7" stroke={color} stroke-width="2" stroke-dasharray={dash} />
              <circle cx="13" cy="7" r="3.5" fill={color} />
            </svg>
          {:else if kind === 'note'}
            <i title={label} class="block h-1.5 w-1.5 rounded-full bg-contour-weakest" />
          {:else}
            <i title={label} style:width="10px" style:height="14px" class="block bg-surface-weakest" style:background-color={color} />
          {/if}
        </dt>
        <dd><span class="{kind === 'note' ? 'text-contour-weak' : labelClass} {textSize}">{label}</span></dd>
      </div>
    {/key}
  {/each}
</dl>
