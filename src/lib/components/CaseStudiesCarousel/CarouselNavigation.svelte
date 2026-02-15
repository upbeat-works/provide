<script>
	import { createEventDispatcher } from 'svelte';

	export let currentIndex = 0;
	export let totalDots = 1;
	export let canGoPrev = true;
	export let canGoNext = true;

	const dispatch = createEventDispatcher();
</script>

<div class="flex items-center justify-center gap-4 mt-8">
	<button
		on:click={() => dispatch('prev')}
		disabled={!canGoPrev}
		class="w-8 h-8 rounded-full border border-contour-weakest flex items-center justify-center
           hover:bg-surface-weaker disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		aria-label="Previous slides"
	>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M10 4L6 8L10 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	</button>

	<div class="flex gap-2">
		{#each Array(totalDots) as _, i}
			<button
				on:click={() => dispatch('dot', { index: i })}
				class="w-2 h-2 rounded-full transition-colors"
				class:bg-theme-base={i === currentIndex}
				class:bg-contour-weakest={i !== currentIndex}
				aria-label="Go to slide group {i + 1}"
			/>
		{/each}
	</div>

	<button
		on:click={() => dispatch('next')}
		disabled={!canGoNext}
		class="w-8 h-8 rounded-full border border-contour-weakest flex items-center justify-center
           hover:bg-surface-weaker disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
		aria-label="Next slides"
	>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	</button>
</div>
