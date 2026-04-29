<script>
  export let label = undefined;
  export let title;
  export let description = undefined;
  export let className = '';
</script>

<div class={`overflow-hidden relative ${className || 'bg-theme-700'}`}>
  <img src="/img/grain-bg.png" alt="" aria-hidden="true" class="absolute inset-0 w-full h-full object-cover opacity-[0.18] pointer-events-none mix-blend-soft-light" />
  <div class="relative mx-auto max-w-6xl px-2 sm:px-6 pb-14 sm:pb-20 pt-6 sm:pt-16">
    {#if $$slots.label}
      <div class="mb-3"><slot name="label" /></div>
    {:else if label}
      <p class="text-xs uppercase tracking-widest font-bold text-sky-300 mb-3">{label}</p>
    {/if}
    <h1 class="text-4xl sm:text-5xl font-normal text-white max-w-2xl">{title}</h1>
    {#if description}
      <p class="text-lg text-sky-100 mt-4 max-w-xl">{description}</p>
    {/if}
  </div>
</div>
