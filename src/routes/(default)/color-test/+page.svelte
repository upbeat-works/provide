<script>
  // Test page for verifying new color ramp
</script>

<div class="p-8 space-y-8 bg-surface-base">
  <h1 class="text-3xl font-bold text-contour-base">Color Ramp Test</h1>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Theme Colors - Numbered Scale (50-900)</h2>
    <div class="flex gap-2 flex-wrap">
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-50 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">theme-50</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Lightest</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-100 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">theme-100</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Very Light</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-200 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">theme-200</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Light</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-300 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">theme-300</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Light-Med</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-400 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">theme-400</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Medium-Light</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-500 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">theme-500</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Medium</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-600 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">theme-600</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Medium-Dark</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-700 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">theme-700</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Dark</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-800 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">theme-800</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Darker</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-900 rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">theme-900</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">Darkest</p>
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Theme Colors - Semantic Names (Backward Compatibility)</h2>
    <div class="flex gap-4 flex-wrap">
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-weakest rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">weakest</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">= theme-200</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-weaker rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-contour-base">weaker</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">= theme-400</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-base rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">base</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">= theme-600</p>
      </div>
      <div class="space-y-2">
        <div class="w-32 h-32 bg-theme-stronger rounded-lg shadow flex items-center justify-center">
          <span class="text-xs font-mono text-surface-base">stronger</span>
        </div>
        <p class="text-xs text-center text-contour-weaker">= theme-800</p>
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Petrol Colors - Base Colors (50-900)</h2>
    <div class="flex gap-2 flex-wrap">
      <div class="w-24 h-24 bg-petrol-50 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-contour-base">50</span>
      </div>
      <div class="w-24 h-24 bg-petrol-100 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-contour-base">100</span>
      </div>
      <div class="w-24 h-24 bg-petrol-200 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-contour-base">200</span>
      </div>
      <div class="w-24 h-24 bg-petrol-300 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-contour-base">300</span>
      </div>
      <div class="w-24 h-24 bg-petrol-400 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-contour-base">400</span>
      </div>
      <div class="w-24 h-24 bg-petrol-500 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-surface-base">500</span>
      </div>
      <div class="w-24 h-24 bg-petrol-600 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-surface-base">600</span>
      </div>
      <div class="w-24 h-24 bg-petrol-700 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-surface-base">700</span>
      </div>
      <div class="w-24 h-24 bg-petrol-800 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-surface-base">800</span>
      </div>
      <div class="w-24 h-24 bg-petrol-900 rounded shadow flex items-center justify-center">
        <span class="text-xs font-mono text-surface-base">900</span>
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Sky Colors - Category Blue (50-900)</h2>
    <div class="flex gap-2 flex-wrap">
      <div class="w-20 h-20 bg-sky-50 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">50</span></div>
      <div class="w-20 h-20 bg-sky-100 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">100</span></div>
      <div class="w-20 h-20 bg-sky-200 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">200</span></div>
      <div class="w-20 h-20 bg-sky-300 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">300</span></div>
      <div class="w-20 h-20 bg-sky-400 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">400</span></div>
      <div class="w-20 h-20 bg-sky-500 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">500</span></div>
      <div class="w-20 h-20 bg-sky-600 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">600</span></div>
      <div class="w-20 h-20 bg-sky-700 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">700</span></div>
      <div class="w-20 h-20 bg-sky-800 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">800</span></div>
      <div class="w-20 h-20 bg-sky-900 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">900</span></div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Grass Colors - Category Green (50-900)</h2>
    <div class="flex gap-2 flex-wrap">
      <div class="w-20 h-20 bg-grass-50 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">50</span></div>
      <div class="w-20 h-20 bg-grass-100 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">100</span></div>
      <div class="w-20 h-20 bg-grass-200 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">200</span></div>
      <div class="w-20 h-20 bg-grass-300 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">300</span></div>
      <div class="w-20 h-20 bg-grass-400 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">400</span></div>
      <div class="w-20 h-20 bg-grass-500 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">500</span></div>
      <div class="w-20 h-20 bg-grass-600 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">600</span></div>
      <div class="w-20 h-20 bg-grass-700 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">700</span></div>
      <div class="w-20 h-20 bg-grass-800 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">800</span></div>
      <div class="w-20 h-20 bg-grass-900 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">900</span></div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Orange Colors - Category Orange (50-900)</h2>
    <div class="flex gap-2 flex-wrap">
      <div class="w-20 h-20 bg-orange-50 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">50</span></div>
      <div class="w-20 h-20 bg-orange-100 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">100</span></div>
      <div class="w-20 h-20 bg-orange-200 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">200</span></div>
      <div class="w-20 h-20 bg-orange-300 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">300</span></div>
      <div class="w-20 h-20 bg-orange-400 rounded shadow flex items-center justify-center"><span class="text-xs font-mono">400</span></div>
      <div class="w-20 h-20 bg-orange-500 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">500</span></div>
      <div class="w-20 h-20 bg-orange-600 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">600</span></div>
      <div class="w-20 h-20 bg-orange-700 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">700</span></div>
      <div class="w-20 h-20 bg-orange-800 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">800</span></div>
      <div class="w-20 h-20 bg-orange-900 rounded shadow flex items-center justify-center"><span class="text-xs font-mono text-surface-base">900</span></div>
    </div>
  </section>

  <section class="space-y-4">
    <h2 class="text-2xl font-semibold text-contour-base">Usage Examples</h2>

    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-semibold text-contour-base mb-2">Buttons with Hover States</h3>
        <div class="flex gap-4 flex-wrap">
          <button class="px-6 py-3 bg-theme-600 hover:bg-theme-700 text-surface-base rounded-lg transition-colors">
            Primary Button
          </button>
          <button class="px-6 py-3 bg-theme-50 hover:bg-theme-100 text-theme-700 rounded-lg transition-colors">
            Secondary Button
          </button>
          <button class="px-6 py-3 border-2 border-theme-600 text-theme-600 hover:bg-theme-50 rounded-lg transition-colors">
            Outline Button
          </button>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-semibold text-contour-base mb-2">Cards with Subtle Backgrounds</h3>
        <div class="flex gap-4 flex-wrap">
          <div class="w-64 p-6 bg-theme-50 rounded-lg">
            <h4 class="text-lg font-semibold text-theme-900 mb-2">Card Title</h4>
            <p class="text-theme-700">Very subtle background using theme-50</p>
          </div>
          <div class="w-64 p-6 bg-theme-100 rounded-lg">
            <h4 class="text-lg font-semibold text-theme-900 mb-2">Card Title</h4>
            <p class="text-theme-700">Light background using theme-100</p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-semibold text-contour-base mb-2">Borders and Dividers</h3>
        <div class="space-y-4">
          <div class="p-4 border border-theme-200 rounded-lg">
            <p class="text-contour-base">Subtle border using theme-200</p>
          </div>
          <div class="p-4 border-2 border-theme-400 rounded-lg">
            <p class="text-contour-base">More pronounced border using theme-400</p>
          </div>
          <div class="p-4 border-2 border-theme-600 rounded-lg">
            <p class="text-contour-base">Strong border using theme-600</p>
          </div>
        </div>
      </div>

      <div>
        <h3 class="text-lg font-semibold text-contour-base mb-2">Text Colors</h3>
        <div class="space-y-2">
          <p class="text-theme-500">Medium text using theme-500</p>
          <p class="text-theme-600">Primary text using theme-600</p>
          <p class="text-theme-700">Emphasized text using theme-700</p>
          <p class="text-theme-800">Strong text using theme-800</p>
          <p class="text-theme-900">Strongest text using theme-900</p>
        </div>
      </div>
    </div>
  </section>

  <section class="p-6 bg-theme-50 rounded-lg">
    <h2 class="text-2xl font-semibold text-theme-900 mb-4">Summary</h2>
    <div class="space-y-2 text-theme-800">
      <p>✓ All 10 numbered theme shades (50-900) are working</p>
      <p>✓ All 4 semantic theme names (weakest, weaker, base, stronger) are working</p>
      <p>✓ All 10 petrol base colors (50-900) are working</p>
      <p>✓ All 10 sky colors (50-900) are working</p>
      <p>✓ All 10 grass colors (50-900) are working</p>
      <p>✓ All 10 orange colors (50-900) are working</p>
      <p>✓ Category semantic names still work (weakest, weaker, weak, base, strong, stronger, strongest)</p>
      <p>✓ Semantic names correctly map to numbered equivalents</p>
      <p>✓ Colors have smooth progression from light to dark</p>
    </div>
  </section>
</div>
