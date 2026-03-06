<script>
	import { PATH_ADAPTATION } from '$config';
	import { getStrapiImageAtSize } from '$lib/utils';
	import LinkArrow from '$lib/helper/icons/LinkArrow.svelte';
	import CategoryBadge from './CategoryBadge.svelte';

	export let study;

	$: imageUrl = study.image ? getStrapiImageAtSize(study.image) : null;
</script>

<a
	href="/{PATH_ADAPTATION}/{study.city.uid}"
	class="flex flex-col bg-white rounded-sm overflow-hidden border border-contour-weakest group h-full"
>
	<div class="relative aspect-[4/3] overflow-hidden">
		{#if imageUrl}
			<img
				src={imageUrl}
				alt={study.image?.alternativeText ?? study.city.label}
				class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
			/>
		{:else}
			<div class="w-full h-full bg-gray-200" />
		{/if}
		<CategoryBadge category={study.category} />
	</div>

	<div class="p-6 flex flex-col gap-2 flex-1">
		<h3 class="font-normal text-2xl text-theme-800 leading-normal">{study.city.label}</h3>
		<p class="text-theme-base text-base font-normal leading-normal line-clamp-3 mb-8">{study.abstract}</p>
		<div class="mt-auto w-10 h-10 bg-surface-weaker flex items-center justify-center text-theme-base group-hover:bg-theme-base group-hover:text-white transition-colors">
			<LinkArrow />
		</div>
	</div>
</a>
