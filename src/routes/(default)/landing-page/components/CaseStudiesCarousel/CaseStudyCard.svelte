<script>
	import { PATH_CASE_STUDIES } from '$config';
	import { getStrapiImageAtSize } from '$lib/utils/utils';
	import LinkArrow from '$lib/components/icons/LinkArrow.svelte';
	import CategoryBadge from './CategoryBadge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	export let study;

	$: imageUrl = study.image ? getStrapiImageAtSize(study.image) : null;
</script>

<a
	href="/{PATH_CASE_STUDIES}/{study.city.uid}"
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
		<Button
			variant="secondary"
			tabindex="-1"
			class="mt-auto w-10 h-10 p-0 justify-center pointer-events-none group-hover:bg-theme-base group-hover:text-white"
		>
			<span><LinkArrow /></span>
		</Button>
	</div>
</a>
