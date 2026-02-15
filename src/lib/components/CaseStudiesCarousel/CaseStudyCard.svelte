<script>
	import { PATH_ADAPTATION } from '$config';
	import { getStrapiImageAtSize } from '$lib/utils';
	import LinkArrow from '$lib/helper/icons/LinkArrow.svelte';
	import CategoryBadge from './CategoryBadge.svelte';

	export let study;

	$: imageUrl = study.image ? getStrapiImageAtSize(study.image) : '/img/case-study-placeholder.jpg';
</script>

<a
	href="/{PATH_ADAPTATION}/{study.city.uid}"
	class="block bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow group h-full"
>
	<div class="relative aspect-[4/3] overflow-hidden">
		<img
			src={imageUrl}
			alt={study.image?.alternativeText ?? study.city.label}
			class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
		/>
		<CategoryBadge category={study.category} />
	</div>

	<div class="p-6 flex flex-col gap-2">
		<h3 class="font-bold text-xl text-theme-stronger uppercase">{study.city.label}</h3>
		<p class="text-theme-base text-sm line-clamp-3">{study.abstract}</p>
		<div class="mt-4 text-theme-base">
			<LinkArrow />
		</div>
	</div>
</a>
