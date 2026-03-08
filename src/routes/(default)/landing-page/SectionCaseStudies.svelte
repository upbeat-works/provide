<script>
	import { PATH_ADAPTATION } from '$config';
	import CaseStudiesCarousel from '$lib/components/CaseStudiesCarousel/CaseStudiesCarousel.svelte';

	export let caseStudies = [];
</script>

<section>
	<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
		<h2 class="text-heading-lg text-theme-800 font-normal">Case studies</h2>
		<div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 md:text-left">
			<p class="text-theme-800 text-base font-normal leading-normal max-w-md">
				Grab report-ready visuals and data, and learn from case studies that show how insights are used in practice.
				<a href="/{PATH_ADAPTATION}" class="text-theme-base font-bold hover:underline whitespace-nowrap">
					View all
				</a>
			</p>
		</div>
	</div>

	{#if caseStudies.length}
		<CaseStudiesCarousel {caseStudies} />
	{/if}
</section>
