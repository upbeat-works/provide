<script>
  import { LABEL_DOCUMENTATION, LABEL_CONTACT, LABEL_ABOUT, PATH_ABOUT, PATH_CONTACT, PATH_DOCUMENTATION, PATH_EXPLORE, LABEL_EXPLORE, PATH_ADAPTATION, TITLE_PROJECT, TITLE_SITE } from '$config';
  import { version } from '$app/environment';
  export let buildDate;
</script>

<footer class="bg-surface-weaker border-t border-contour-weakest">
  <div class="mx-auto max-w-7xl px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-12">
    <!-- Left: Logo + Description -->
    <div>
      <div class="inline-flex gap-3 text-md">
        <span class="text-theme-stronger font-bold uppercase tracking-widest">
          {TITLE_PROJECT}
        </span>
        <span class="text-theme-stronger" role="presentation" aria-hidden="true">|</span>
        <span class="text-theme-stronger">{TITLE_SITE}</span>
      </div>
      <p class="mt-4 text-sm text-theme-stronger">
        The development of the dashboard was led by <a
          href="https://climateanalytics.org/"
          class="underline decoration-theme-base hover:text-theme-stronger hover:decoration-theme-stronger transition-colors">Climate Analytics</a
        >, with contributions from the
        <a href="https://www.provide-h2020.eu/" class="underline decoration-theme-base hover:text-theme-stronger hover:decoration-theme-stronger transition-colors">PROVIDE</a> consortium.
      </p>
    </div>

    <!-- Middle: Navigation Links -->
    <nav class="md:pl-12">
      <ul class="space-y-2">
        <li><a class="text-sm text-theme-stronger hover:underline transition-colors" href="/{PATH_EXPLORE}">{LABEL_EXPLORE}</a></li>
        <li><a class="text-sm text-theme-stronger hover:underline transition-colors" href="/{PATH_ADAPTATION}">Case Studies</a></li>
        <li><a class="text-sm text-theme-stronger hover:underline transition-colors" href="/{PATH_DOCUMENTATION}">{LABEL_DOCUMENTATION}</a></li>
        <li><a class="text-sm text-theme-stronger hover:underline transition-colors" href="/{PATH_ABOUT}">{LABEL_ABOUT}</a></li>
        <li><a class="text-sm text-theme-stronger hover:underline transition-colors" href="/{PATH_CONTACT}">{LABEL_CONTACT}</a></li>
      </ul>
    </nav>

    <!-- Right: EU Funding Badge -->
    <div class="flex gap-x-4 items-start">
      <img
        class="max-w-[100px] flex-shrink-0"
        alt="Logo of the European Union reading 'Funded by the European Union'"
        src="/img/eu-flag.svg"
      />
      <p class="text-xs text-text-weaker">
        This project has received funding from the European Union's Horizon 2020 research and innovation programme under grant agreement No. 101003687.
      </p>
    </div>
  </div>

  <!-- Bottom Bar -->
  <div class="bg-petrol-50 py-3">
    <div class="text-sm mx-auto max-w-7xl px-6 flex justify-between">
      <span class="text-contour-weak">IIASA <time datetime={new Date().getFullYear()}>{new Date().getFullYear()}</time></span>
      <span class="text-contour-weaker text-xs"
        >Version {version}. Build
        <time title={new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'long' }).format(buildDate)} datetime={buildDate.toISOString()}
          >{buildDate.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })}</time
        ></span
      >
    </div>
  </div>
</footer>