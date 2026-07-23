<script>
  // Procedural grain/noise overlay used on the tool hero headers (provide, avoid)
  // so they share the exact same texture. `id` must be unique per rendered page
  // because it references an SVG filter. A lower `baseFrequency` / fewer
  // `numOctaves` make the grain coarser ("thicker"); `opacity` controls presence.
  export let id = 'hero-grain';
  export let baseFrequency = 0.55;
  export let numOctaves = 2;
  export let opacity = 0.22;
</script>

<svg
  class="absolute inset-0 w-full h-full pointer-events-none"
  style={`opacity:${opacity}`}
  aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg"
>
  <filter {id}>
    <feTurbulence type="fractalNoise" baseFrequency={baseFrequency} numOctaves={numOctaves} stitchTiles="stitch" />
    <feColorMatrix type="saturate" values="0" />
  </filter>
  <rect width="100%" height="100%" filter={`url(#${id})`} />
</svg>
