<script>
	import { PATH_EXPLORE, PATH_IMPACT, PATH_AVOID } from '$config';

	const cards = [
		{
			path: PATH_IMPACT,
			title: 'Explore future impacts',
			intro: [
				'This mode allows you to explore different climate futures and how they will affect the environment and people.',
				'Choose your geography type and choose an indicator to explore how future climate impacts will develop under various emission scenarios.'
			],
			audience: [
				'Climate scientists (terrestrial, marine and urban)',
				'Experts working on climate risks',
				'Climate litigation experts',
				'Science communicators',
				'National policy makers'
			],
			image: '/img/impacts.png',
			imageAlt: 'One scenario and many resulting impacts'
		},
		{
			path: PATH_AVOID,
			title: 'Avoiding future impacts',
			intro: [
				'In this mode you can explore how we can avoid reaching undesirable climate impact levels in urban areas.',
				'You can choose a city, an urban heat indicator and the level of impact, and see when your selected level of impact will be exceeded. You can then explore which climate action pathway might help your city avoid this impact level.'
			],
			audience: [
				'Urban planners, policy makers and climate adaptation experts',
				'Science communicators',
				'Experts working on climate risks'
			],
			image: '/img/emission-scenarios.png',
			imageAlt: 'One scenario and many resulting impacts'
		}
	];
</script>

<section class="max-w-7xl mx-auto">
	<h2 class="text-3xl text-center p-16 text-theme-800 border-b">Go deeper with our tools for advanced analysis</h2>
	<div class="p-12 grid md:grid-cols-2 gap-y-6 gap-x-4 lg:gap-x-24 lg:gap-y-24">
	{#each cards as { path, title, intro, audience, image, imageAlt }}
		<a
			href={`/${PATH_EXPLORE}/${path}`}
			class="hover:bg-surface-weakest hover:text-theme-base transition-colors grid grid-rows-[1fr_auto_auto] bg-[#FCFDF6] p-4 sm:p-10 md:p-12"
		>
			<div class="flex flex-col gap-y-2 my-4">
				<span class="uppercase text-center font-bold text-xl tracking-wide text-current">{title}</span>
				<div class="block text-center text-base sm:text-lg md:leading-normal text-black">
					{#each intro as paragraph, i}
						<p class:mb-5={i === 0}>{paragraph}</p>
					{/each}
				</div>
			</div>
			{#if audience.length}
				<span class="text-contour-weaker text-sm mt-6">Most suitable for:</span>
				<ul class="my-2 flex gap-y-2 flex-col text-base">
					{#each audience as label}
						<li class="flex items-center gap-x-2">
							<svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path
									d="M3.17688 7.73688C2.77774 7.36946 2.14852 7.38691 1.77148 7.77585C1.39443 8.1648 1.41234 8.77795 1.81147 9.14537L5.71148 12.7355C6.12186 13.1132 6.77232 13.0826 7.1434 12.668L15.255 3.6056C15.6159 3.20239 15.5731 2.59041 15.1593 2.23871C14.7455 1.88702 14.1175 1.92878 13.7566 2.332L6.32492 10.6347L3.17688 7.73688Z"
									fill="#316F91"
								/>
							</svg>
							<span class="text-black">{label}</span>
						</li>
					{/each}
				</ul>
			{/if}
			<figure class="p-0 md:p-0 py-6 sm:px-6 sm:pt-4 md:pt-8 pb-4">
				<img src={image} alt={imageAlt} />
			</figure>
		</a>
	{/each}
	</div>
</section>
