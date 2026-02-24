<script>
	import { PATH_EXPLORE, PATH_IMPACT, PATH_AVOID } from '$config';
	import AnalysisTools from '$lib/helper/icons/AnalysisTools.svelte';

	const cards = [
		{
			path: PATH_AVOID,
			image: '/img/emission-scenarios.png',
			imageAlt: 'Chart showing compatible scenarios and impact levels',
			description:
				'Avoiding future impacts explores which scenarios minimise the risk from certain impacts in cities and their rural surroundings.',
			project: 'Provide',
			geography: 'Cities',
			dataSource: 'CMIP6'
		},
		{
			path: PATH_IMPACT,
			image: '/img/impacts.png',
			imageAlt: 'Map showing future climate impacts across geographies',
			description:
				'Explore future impacts shows how different climate futures will affect the environment and people across different emission scenarios.',
			project: 'Provide',
			geography: 'Global',
			dataSource: 'CMIP6'
		}
	];

	let scrollContainer;
	let currentIndex = 0;

	$: canGoPrev = currentIndex > 0;
	$: canGoNext = currentIndex < cards.length - 1;

	function scrollToCard(index) {
		if (!scrollContainer) return;
		const cardWidth = scrollContainer.scrollWidth / cards.length;
		scrollContainer.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
	}

	function handleScroll() {
		if (!scrollContainer) return;
		const cardWidth = scrollContainer.scrollWidth / cards.length;
		currentIndex = Math.round(scrollContainer.scrollLeft / cardWidth);
	}

	function handlePrev() {
		if (canGoPrev) scrollToCard(currentIndex - 1);
	}

	function handleNext() {
		if (canGoNext) scrollToCard(currentIndex + 1);
	}
</script>

<section class="py-20">
	<div class="grid md:grid-cols-[1fr_2fr]">
		<!-- Left: heading and navigation -->
		<div
			class="flex flex-col px-8 md:px-12 py-2 md:py-4 border-b md:border-b-0 md:border-r border-contour-weakest"
		>
			<div class="w-14 h-14 mb-8">
				<AnalysisTools class="w-full h-full" />
			</div>
			<h2 class="text-2xl md:text-3xl text-theme-800 leading-snug mb-8">
				<span class="text-theme-base">Go deeper</span> with our tools for advanced analysis
			</h2>
			<div class="flex gap-2">
				<button
					on:click={handlePrev}
					disabled={!canGoPrev}
					class="w-9 h-9 flex items-center justify-center bg-surface-weaker hover:bg-surface-weakest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					aria-label="Previous card"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path
							d="M10 4L6 8L10 12"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
				<button
					on:click={handleNext}
					disabled={!canGoNext}
					class="w-9 h-9 flex items-center justify-center bg-surface-weaker hover:bg-surface-weakest transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					aria-label="Next card"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
						<path
							d="M6 4L10 8L6 12"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Right: carousel -->
		<div class="overflow-hidden py-2 md:py-4 pl-8 md:pl-12">
			<div
				bind:this={scrollContainer}
				on:scroll={handleScroll}
				class="flex gap-6 overflow-x-auto scrollbar-hide"
				style="scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;"
			>
				{#each cards as card}
					<a
						href={`/${PATH_EXPLORE}/${card.path}`}
						class="flex-shrink-0 w-[85%] md:w-[60%] bg-white group"
						style="scroll-snap-align: start;"
					>
						<figure class="m-0 overflow-hidden bg-surface-weaker">
							<img
								src={card.image}
								alt={card.imageAlt}
								class="w-full aspect-video object-contain group-hover:scale-[1.02] transition-transform duration-300"
							/>
						</figure>
						<div class="pt-4">
							<p class="text-xl font-normal text-theme-800 leading-snug mb-4 lg:max-w-[80%]">{card.description}</p>
							<hr class="border-contour-weakest mb-4" />
							<dl class="grid grid-cols-3 gap-4 text-sm">
								<div>
									<dt class="uppercase text-xs tracking-widest text-text-weaker font-medium mb-1">
										Project
									</dt>
									<dd class="text-theme-base">{card.project}</dd>
								</div>
								<div>
									<dt class="uppercase text-xs tracking-widest text-text-weaker font-medium mb-1">
										Geography
									</dt>
									<dd class="text-theme-base">{card.geography}</dd>
								</div>
								<div>
									<dt class="uppercase text-xs tracking-widest text-text-weaker font-medium mb-1">
										Data source
									</dt>
									<dd class="text-theme-base">{card.dataSource}</dd>
								</div>
							</dl>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</div>
</section>
