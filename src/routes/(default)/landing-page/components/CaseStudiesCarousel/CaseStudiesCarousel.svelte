<script>
	import { onMount } from 'svelte';
	import CaseStudyCard from './CaseStudyCard.svelte';
	import CarouselNavigation from './CarouselNavigation.svelte';

	export let caseStudies = [];

	let scrollContainer;
	let currentIndex = 0;
	let cardsPerView = 3;

	$: totalDots = Math.ceil(caseStudies.length / cardsPerView);
	$: canGoPrev = currentIndex > 0;
	$: canGoNext = currentIndex < totalDots - 1;

	function updateCardsPerView() {
		if (typeof window === 'undefined') return;
		if (window.innerWidth < 768) {
			cardsPerView = 1;
		} else if (window.innerWidth < 1024) {
			cardsPerView = 2;
		} else {
			cardsPerView = 3;
		}
	}

	function scrollToIndex(index) {
		if (!scrollContainer) return;
		const cardWidth = scrollContainer.scrollWidth / caseStudies.length;
		const target = index * cardsPerView * cardWidth;
		scrollContainer.scrollTo({ left: target, behavior: 'smooth' });
	}

	function handleScroll() {
		if (!scrollContainer || caseStudies.length === 0) return;
		const cardWidth = scrollContainer.scrollWidth / caseStudies.length;
		const scrollPosition = scrollContainer.scrollLeft;
		currentIndex = Math.round(scrollPosition / (cardWidth * cardsPerView));
	}

	function handlePrev() {
		if (canGoPrev) {
			scrollToIndex(currentIndex - 1);
		}
	}

	function handleNext() {
		if (canGoNext) {
			scrollToIndex(currentIndex + 1);
		}
	}

	function handleDot(event) {
		scrollToIndex(event.detail.index);
	}

	onMount(() => {
		updateCardsPerView();
		window.addEventListener('resize', updateCardsPerView);
		return () => window.removeEventListener('resize', updateCardsPerView);
	});
</script>

<div class="overflow-hidden">
	<div
		bind:this={scrollContainer}
		on:scroll={handleScroll}
		class="flex gap-6 overflow-x-auto scroll-snap-x scrollbar-hide pb-2"
		style="scroll-snap-type: x mandatory;"
	>
		{#each caseStudies as study}
			<div
				class="flex-shrink-0 w-full md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
				style="scroll-snap-align: start;"
			>
				<CaseStudyCard {study} />
			</div>
		{/each}
	</div>

	{#if totalDots > 1}
		<CarouselNavigation
			{currentIndex}
			{totalDots}
			{canGoPrev}
			{canGoNext}
			on:prev={handlePrev}
			on:next={handleNext}
			on:dot={handleDot}
		/>
	{/if}
</div>
