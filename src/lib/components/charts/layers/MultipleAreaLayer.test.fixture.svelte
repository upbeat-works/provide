<script>
  import { setContext } from 'svelte';
  import { readable } from 'svelte/store';
  import MultipleAreaLayer from './MultipleAreaLayer.svelte';

  const values = [
    { year: 2030, min: 1, max: 3 },
    { year: 2040, min: undefined, max: 4 },
    { year: 2050, min: 2, max: 5 },
  ];
  setContext('LayerCake', {
    data: readable([{ values, range: '#000' }]),
    xGet: readable((point) => point.year),
    yScale: readable((value) => value * 10),
  });
</script>

<svg><MultipleAreaLayer /></svg>
