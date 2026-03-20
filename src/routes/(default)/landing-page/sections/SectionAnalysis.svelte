<script>
	import { PATH_EXPLORE, PATH_IMPACT, PATH_AVOID } from '$config';
	import AnalysisTools from '$lib/components/icons/AnalysisTools.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LinkArrow from '$lib/components/icons/LinkArrow.svelte';

	const cards = [
		{
			path: `${PATH_IMPACT}/${PATH_AVOID}`,
			image: '/img/emission-scenarios.png',
			imageAlt: 'Chart showing compatible scenarios and impact levels',
			description:
				'Avoiding future impacts explores which scenarios minimise the risk from certain impacts in cities and their rural surroundings.',
			project: 'Provide',
			geography: 'Cities',
			dataSource: 'CMIP6'
		},
		{
			path: `${PATH_IMPACT}/${PATH_EXPLORE}`,
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

<section class="max-w-7xl mx-auto">
	<div class="pl-6 py-12 grid md:grid-cols-[1fr_2fr] gap-x-24 items-start">

		<!-- Left: heading + nav -->
		<div class="flex flex-col gap-8">
			<div class="w-14 h-14">
				<AnalysisTools class="w-full h-full" />
			</div>
			<h2 class="text-2xl md:text-3xl text-theme-800 leading-snug">
				<span class="text-theme-base">Go deeper</span> with our tools for advanced analysis
			</h2>
			<div class="flex gap-2">
				<Button
					variant="secondary"
					on:click={handlePrev}
					disabled={!canGoPrev}
					class="w-8 h-8 p-0 justify-center"
					aria-label="Previous card"
				>
					<span class="rotate-180"><LinkArrow /></span>
				</Button>
				<Button
					variant="secondary"
					on:click={handleNext}
					disabled={!canGoNext}
					class="w-8 h-8 p-0 justify-center"
					aria-label="Next card"
				>
					<span><LinkArrow /></span>
				</Button>
			</div>
		</div>

		<!-- Right: carousel -->
		<div class="py-2 md:py-4 min-w-0 -ml-4 md:pl-0">
			<div
				bind:this={scrollContainer}
				on:scroll={handleScroll}
				class="flex gap-6 overflow-x-auto scrollbar-hide"
				style="scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;"
			>
				{#each cards as card}
					<a
						href={card.path}
						class="flex-shrink-0 w-[85%] lg:w-[600px] bg-white hover:bg-surface-weaker transition-colors group"
						style="scroll-snap-align: start;"
					>
						<div class="p-4">
							<figure class="m-0 mb-8 overflow-hidden bg-grass-50 border border-grass-200 rounded-[2px]">
								<img
									src={card.image}
									alt={card.imageAlt}
									class="w-full aspect-video object-contain group-hover:scale-[1.02] transition-transform duration-300"
								/>
							</figure>
							<p class="text-xl font-normal text-theme-800 leading-snug mb-8 lg:max-w-[80%]">{card.description}</p>
							<hr class="border-theme-200 mb-4" />
							<dl class="grid grid-cols-3 gap-4 text-sm mb-8">
								<div>
									<dt class="uppercase text-xs tracking-[0.84px] text-theme-800 font-semibold mb-1">Project</dt>
									<dd class="text-theme-base text-base font-semibold">{card.project}</dd>
								</div>
								<div>
									<dt class="uppercase text-xs tracking-[0.84px] text-theme-800 font-semibold mb-1">Geography</dt>
									<dd class="text-theme-base text-base font-semibold">{card.geography}</dd>
								</div>
								<div>
									<dt class="uppercase text-xs tracking-[0.84px] text-theme-800 font-semibold mb-1">Data source</dt>
									<dd class="text-theme-base text-base font-semibold">{card.dataSource}</dd>
								</div>
							</dl>
						</div>
					</a>
				{/each}
			</div>
		</div>

	</div>
</section>
