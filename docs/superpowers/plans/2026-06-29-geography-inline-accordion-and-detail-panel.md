# Geography Inline Accordion + Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the geography selector's drill-in/replace flow with an inline nested accordion, make `cities` country-scoped, and enrich the right-hand detail panel using only data-backed fields.

**Architecture:** All new behavior is expressed as pure helpers in `geography-tree.js` (unit-tested with `bun:test`), with the Svelte components acting as thin renderers over those helpers. No API/schema change — everything derives from the existing `GEOGRAPHY_INDEX` (built by `buildIndex`) and `GEOGRAPHY_TYPES`.

**Tech Stack:** SvelteKit, `@rgossiaux/svelte-headlessui` (RadioGroup), Tailwind, `bun:test`.

## Global Constraints

- **Testing:** Pure logic is unit-tested with `bun:test` (run `bun test <file>`). There is **no Svelte component test harness** in this repo (no testing-library/vitest/jsdom) — do **not** introduce one. Component behavior is verified manually by running the app. Keep components as thin glue over tested helpers.
- **RED step rule:** A new helper's first test must fail on a *behavior assertion*, not a missing module. Stub the function (returning a wrong/empty value) so production code runs and the assertion fails.
- **Commits:** Per the project owner's rule, **do not create git commits.** Where a task ends, `git add` the changed files and **stop for the owner to review and commit**. Never run `git commit`.
- **Data facts:** Geography types are `continent` (not selectable), `admin0`, `eez`, `cities`, `river_basins`, `glacier_regions`, `macroeconomies`, `northern_latitudes`. A country's drillable child types are `cities`, `river_basins`, `eez` (`CHILD_TYPE_ORDER`). `cities` is the only country-scoped type (removed from top-level pills).
- **Spec:** `docs/superpowers/specs/2026-06-29-geography-inline-accordion-and-detail-panel-design.md`.

---

## File Structure

- `src/lib/components/controls/GeographySelection/geography-tree.js` — add pure helpers `parentCountriesOf`, `continentOf`, `childGroups`.
- `src/lib/components/controls/GeographySelection/geography-tree.test.js` — unit tests for the three helpers.
- `src/lib/components/controls/GeographySelection/CountryAccordion.svelte` — rewrite: name selects + auto-expands, caret toggles, children rendered inline grouped by type.
- `src/lib/components/controls/GeographySelection/GeographyGroup.svelte` — drop `onDrill` wiring.
- `src/lib/components/controls/GeographySelection/Geographies.svelte` — remove drill-in/replace state and view.
- `src/lib/components/controls/GeographySelection/GeoDetailPanel.svelte` — **new** context card (keeps `GeographySelection.svelte` focused).
- `src/lib/components/controls/GeographySelection/GeographySelection.svelte` — filter `cities` from pills; render `GeoDetailPanel`.

---

## Task 1: `parentCountriesOf` helper

**Files:**
- Modify: `src/lib/components/controls/GeographySelection/geography-tree.js`
- Test: `src/lib/components/controls/GeographySelection/geography-tree.test.js`

**Interfaces:**
- Consumes: `buildIndex(geographies)` → `{ byId, childrenByParent, countriesByContinent }` (already exists).
- Produces: `parentCountriesOf(index, uid)` → array of `admin0` geography objects among the geography's `parents`; `[]` when unknown or no country parents.

- [ ] **Step 1: Write the failing test**

Add to `geography-tree.test.js` (the existing `geographies` fixture already has the transboundary `Nile` with `parents: ['Egypt', 'Sudan']`):

```js
import { buildIndex, childSummary, geoIdOf, parentCountriesOf } from './geography-tree.js';

describe('parentCountriesOf', () => {
  const index = buildIndex(geographies);
  test('returns all admin0 parents for a transboundary child', () => {
    expect(parentCountriesOf(index, 'Nile').map((c) => c.uid)).toEqual(['Egypt', 'Sudan']);
  });
  test('returns the single country parent for a city', () => {
    expect(parentCountriesOf(index, 'Cairo').map((c) => c.uid)).toEqual(['Egypt']);
  });
  test('ignores non-country parents (continents)', () => {
    expect(parentCountriesOf(index, 'Egypt')).toEqual([]); // Egypt's parent is the continent Africa
  });
  test('returns [] for an unknown uid', () => {
    expect(parentCountriesOf(index, 'Atlantis')).toEqual([]);
  });
});
```

- [ ] **Step 2: Add a stub that compiles but fails the assertion**

In `geography-tree.js`:

```js
export function parentCountriesOf(index, uid) {
  return []; // stub — makes the RED fail on behavior, not on a missing module
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: FAIL — `parentCountriesOf` tests expect `['Egypt', 'Sudan']` / `['Egypt']` but get `[]`.

- [ ] **Step 4: Implement**

Replace the stub:

```js
export function parentCountriesOf(index, uid) {
  const geo = index.byId[uid];
  if (!geo) return [];
  return (geo.parents ?? [])
    .map((p) => index.byId[p])
    .filter((p) => p && p.geographyType === 'admin0');
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: PASS.

- [ ] **Step 6: Stage for review** (do not commit — see Global Constraints)

```bash
git add src/lib/components/controls/GeographySelection/geography-tree.js src/lib/components/controls/GeographySelection/geography-tree.test.js
```

---

## Task 2: `continentOf` helper

**Files:**
- Modify: `src/lib/components/controls/GeographySelection/geography-tree.js`
- Test: `src/lib/components/controls/GeographySelection/geography-tree.test.js`

**Interfaces:**
- Produces: `continentOf(index, uid)` → the `continent` geography object among the geography's `parents`, or `null`.

- [ ] **Step 1: Write the failing test**

```js
import { buildIndex, childSummary, geoIdOf, parentCountriesOf, continentOf } from './geography-tree.js';

describe('continentOf', () => {
  const index = buildIndex(geographies);
  test('returns the continent parent of a country', () => {
    expect(continentOf(index, 'Egypt')?.uid).toBe('Africa');
  });
  test('returns null when there is no continent parent', () => {
    expect(continentOf(index, 'Cairo')).toBeNull(); // Cairo's parent is Egypt (a country)
  });
  test('returns null for an unknown uid', () => {
    expect(continentOf(index, 'Atlantis')).toBeNull();
  });
});
```

- [ ] **Step 2: Add a stub that compiles but fails the assertion**

```js
export function continentOf(index, uid) {
  return null; // stub
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: FAIL — `continentOf(index, 'Egypt')?.uid` expects `'Africa'`, gets `undefined`.

- [ ] **Step 4: Implement**

```js
export function continentOf(index, uid) {
  const geo = index.byId[uid];
  if (!geo) return null;
  for (const p of geo.parents ?? []) {
    const parent = index.byId[p];
    if (parent && parent.geographyType === 'continent') return parent;
  }
  return null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: PASS.

- [ ] **Step 6: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/geography-tree.js src/lib/components/controls/GeographySelection/geography-tree.test.js
```

---

## Task 3: `childGroups` helper

**Files:**
- Modify: `src/lib/components/controls/GeographySelection/geography-tree.js`
- Test: `src/lib/components/controls/GeographySelection/geography-tree.test.js`

**Interfaces:**
- Consumes: module-private `CHILD_TYPE_ORDER = ['cities', 'river_basins', 'eez']` (already defined at top of file) and `index.childrenByParent`.
- Produces: `childGroups(index, countryUid)` → ordered `Array<{ type: string, items: object[] }>`, one entry per child type that has items, in `CHILD_TYPE_ORDER`. (Parallels `childSummary`, but returns the full child objects instead of counts.)

- [ ] **Step 1: Write the failing test**

```js
import { buildIndex, childSummary, geoIdOf, parentCountriesOf, continentOf, childGroups } from './geography-tree.js';

describe('childGroups', () => {
  const index = buildIndex(geographies);
  test('returns child objects grouped by type in display order', () => {
    expect(childGroups(index, 'Egypt')).toEqual([
      { type: 'cities', items: [index.byId['Cairo']] },
      { type: 'river_basins', items: [index.byId['Nile']] },
    ]);
  });
  test('returns only the types that have children', () => {
    expect(childGroups(index, 'Sudan')).toEqual([
      { type: 'river_basins', items: [index.byId['Nile']] },
    ]);
  });
  test('returns [] for a geography with no children', () => {
    expect(childGroups(index, 'Cairo')).toEqual([]);
  });
});
```

- [ ] **Step 2: Add a stub that compiles but fails the assertion**

```js
export function childGroups(index, countryUid) {
  return []; // stub
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: FAIL — `childGroups(index, 'Egypt')` expects two groups, gets `[]`.

- [ ] **Step 4: Implement**

```js
export function childGroups(index, countryUid) {
  const children = index.childrenByParent[countryUid] ?? {};
  const groups = [];
  for (const type of CHILD_TYPE_ORDER) {
    const items = children[type];
    if (items && items.length) groups.push({ type, items });
  }
  return groups;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: PASS (all of Task 1–3 tests green).

- [ ] **Step 6: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/geography-tree.js src/lib/components/controls/GeographySelection/geography-tree.test.js
```

---

## Task 4: Rewrite `CountryAccordion.svelte` (inline children, name-selects / caret-toggles)

**Files:**
- Modify (full rewrite): `src/lib/components/controls/GeographySelection/CountryAccordion.svelte`

**Interfaces:**
- Consumes: `childGroups(index, uid)` (Task 3), `GEOGRAPHY_INDEX`, `GEOGRAPHY_TYPES`, `Chevron`, `InteractiveListItem`, `RadioGroupOption`.
- Produces: a country row whose **name area** is a `RadioGroupOption` (selecting the country and auto-expanding) and whose **caret** is a separate button that only toggles. Expanded state renders each child as its own `RadioGroupOption`. The `onDrill` prop is **removed**.
- Note: the caret/count control is **absolutely positioned** at the right so the `InteractiveListItem`'s selected `border-r-3` / background spans the full width and touches the container edge (preserves the earlier border-gap fix).

- [ ] **Step 1: Replace the file contents**

```svelte
<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import Chevron from '$lib/components/icons/Chevron.svelte';
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { childGroups } from './geography-tree.js';

  export let country; // { uid, label, emoji, icon }
  export let hoveredItem;

  let expanded = false;

  $: groups = childGroups($GEOGRAPHY_INDEX, country.uid);
  $: childCount = groups.reduce((n, g) => n + g.items.length, 0);
  $: typeLabel = (uid) => $GEOGRAPHY_TYPES.find((t) => t.uid === uid)?.label ?? uid;

  // Selection (name) and expansion (caret) are distinct affordances. Selecting a
  // country auto-expands so its children are immediately reachable; the caret
  // toggles open/closed without changing the selection.
  function toggle() {
    if (childCount) expanded = !expanded;
  }
  function onCaretKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div>
  <div class="relative flex items-center">
    <div class="grow min-w-0">
      <RadioGroupOption
        value={country.uid}
        let:checked
        class="block focus:bg-surface-weaker focus:outline-none"
        on:click={() => { if (childCount) expanded = true; }}
      >
        <InteractiveListItem icon={country.icon ?? country.emoji} label={country.label} uid={country.uid} selected={checked} bind:hovered={hoveredItem} />
      </RadioGroupOption>
    </div>
    {#if childCount}
      <button
        type="button"
        class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 px-3 text-text-weaker hover:text-theme-base"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        on:click|stopPropagation={toggle}
        on:keydown={onCaretKeydown}
      >
        <span class="text-xs tabular-nums">{childCount}</span>
        <Chevron isOpen={expanded} />
      </button>
    {/if}
  </div>

  {#if expanded}
    <div class="border-l border-contour-weakest ml-5">
      {#each groups as { type, items }}
        <span class="mx-3 mt-2 mb-1 block text-xs uppercase tracking-wide text-text-weaker">{typeLabel(type)}</span>
        {#each items as child}
          <RadioGroupOption value={child.uid} let:checked class="block focus:bg-surface-weaker focus:outline-none">
            <InteractiveListItem icon={child.icon ?? child.emoji} label={child.label} uid={child.uid} selected={checked} bind:hovered={hoveredItem} />
          </RadioGroupOption>
        {/each}
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run build` (or rely on `vite dev` hot reload in Step 3).
Expected: no Svelte/import errors for `CountryAccordion.svelte`. (Note: `GeographyGroup.svelte` still passes `onDrill` — harmless unknown prop — until Task 5; build still succeeds.)

- [ ] **Step 3: Manual verification** (no component test harness — see Global Constraints)

Run: `bun run dev`, open the geography selection modal, Countries tab.
Verify:
1. Clicking a country's **name** selects it (highlight + right border touching the container edge, no white gap) **and** expands it; modal stays open.
2. The expanded panel lists the country's children **inline**, grouped under type sub-headers (e.g. CITIES, RIVER BASINS), each selectable.
3. Clicking a **child** selects that leaf and closes the modal.
4. Clicking the **caret** (right side) toggles expand/collapse **without** changing the selection; the chevron rotates.
5. Countries with no children show no caret/count and don't expand.

- [ ] **Step 4: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/CountryAccordion.svelte
```

---

## Task 5: Remove drill-in/replace from `Geographies.svelte` and `GeographyGroup.svelte`

**Files:**
- Modify: `src/lib/components/controls/GeographySelection/GeographyGroup.svelte`
- Modify: `src/lib/components/controls/GeographySelection/Geographies.svelte`

**Interfaces:**
- Produces: `GeographyGroup` no longer has an `onDrill` prop; `Geographies` no longer has drill state or the "Back to X" view. The countries branch renders continent groups of `CountryAccordion`s directly.

- [ ] **Step 1: Simplify `GeographyGroup.svelte` (full rewrite)**

```svelte
<script>
  import { RadioGroupOption } from '@rgossiaux/svelte-headlessui';
  import InteractiveListItem from '$lib/components/ui/InteractiveListItem.svelte';
  import CountryAccordion from './CountryAccordion.svelte';
  export let group;
  export let hoveredItem;
  // When set, rows render as expandable country accordions.
  export let asCountries = false;
</script>

{#each group as item}
  {#if asCountries}
    <CountryAccordion country={item} bind:hoveredItem />
  {:else}
    <RadioGroupOption value={item.uid} let:checked class="focus:bg-surface-weaker focus:outline-none">
      <InteractiveListItem icon={item.icon ?? item.emoji} label={item.label} uid={item.uid} selected={checked} bind:hovered={hoveredItem} />
    </RadioGroupOption>
  {/if}
{/each}
```

- [ ] **Step 2: Remove drill state from `Geographies.svelte`**

Delete the drill block (the `let drill = null;` declaration through the two reactive resets and the three `drill*` derived statements). Concretely, remove these lines:

```js
  // Drill-in state: when set, the panel shows one country's children of one type.
  let drill = null; // { countryUid, typeUid }
  function onDrill(countryUid, typeUid) {
    drill = { countryUid, typeUid };
  }
  function backToCountries() {
    drill = null;
  }
  // Reset drill-in whenever the active type changes or a search begins.
  $: geographyType, (drill = null);
  $: if (hasSearchTerm) drill = null;
```

and

```js
  $: drillChildren = drill
    ? ($GEOGRAPHY_INDEX.childrenByParent[drill.countryUid]?.[drill.typeUid] ?? [])
    : [];
  $: drillCountryLabel = drill ? ($GEOGRAPHY_INDEX.byId[drill.countryUid]?.label ?? drill.countryUid) : '';
  $: drillTypeLabel = drill ? ($GEOGRAPHY_TYPES.find((t) => t.uid === drill.typeUid)?.label ?? drill.typeUid) : '';
```

Keep `continentGroups` and the `box`/scroll reset.

- [ ] **Step 3: Remove the drill branch and `onDrill` prop in the template**

Replace the `{:else if isCountryMode && drill}` … `{:else if isCountryMode}` portion so there is a single countries branch with no drill view:

```svelte
    {:else if isCountryMode}
      {#each continentGroups as [continentId, countries]}
        <span class="mx-5 mb-1 block text-xs text-text-weaker uppercase tracking-wide border-b border-b-contour-weakest mt-4">{$GEOGRAPHY_INDEX.byId[continentId]?.label ?? continentId}</span>
        <GeographyGroup group={countries} bind:hoveredItem asCountries={true} />
      {/each}
```

(Removes the entire `{:else if isCountryMode && drill}` block — the back button, the header span, and its `GeographyGroup` — and drops `{onDrill}` from the remaining `GeographyGroup`.)

Note: `$GEOGRAPHY_TYPES` may now be unused in `Geographies.svelte`. If your editor/linter flags it, remove it from the `import` on line ~5 (`import { GEOGRAPHY_INDEX } from '$stores/meta.js';`). Leave `GEOGRAPHY_INDEX` (used by `continentGroups`).

- [ ] **Step 4: Manual verification**

Run: `bun run dev`, open the modal.
Verify:
1. Countries tab: continent headers with inline-expandable countries; **no** "‹ Back to …" button appears anywhere.
2. Searching still shows the flat highlighted results; switching pills still works.
3. Non-country pills (EEZ, River Basins, …) still show their flat grouped lists.

- [ ] **Step 5: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/GeographyGroup.svelte src/lib/components/controls/GeographySelection/Geographies.svelte
```

---

## Task 6: New `GeoDetailPanel.svelte` (enriched, data-backed detail card)

**Files:**
- Create: `src/lib/components/controls/GeographySelection/GeoDetailPanel.svelte`

**Interfaces:**
- Consumes: `parentCountriesOf` (Task 1), `continentOf` (Task 2), `childSummary` (existing), `GEOGRAPHY_INDEX`, `GEOGRAPHY_TYPES`, `CURRENT_GEOGRAPHY_UID`.
- Produces: a `<GeoDetailPanel geography={...} />` component that renders identity (icon + label + type badge), continent (countries), parent-country context (single-parent children), "Also linked to" cross-links (multi-country-parent children), and the by-type breakdown (countries). Renders nothing when `geography` is falsy.

- [ ] **Step 1: Create the file**

```svelte
<script>
  import { GEOGRAPHY_INDEX, GEOGRAPHY_TYPES } from '$stores/meta.js';
  import { CURRENT_GEOGRAPHY_UID } from '$stores/state.js';
  import { parentCountriesOf, continentOf, childSummary } from './geography-tree.js';

  export let geography; // selected geography object or undefined

  $: type = geography ? $GEOGRAPHY_TYPES.find((t) => t.uid === geography.geographyType) : null;
  $: isCountry = geography?.geographyType === 'admin0';
  $: continent = geography ? continentOf($GEOGRAPHY_INDEX, geography.uid) : null;
  $: parentCountries = geography && !isCountry ? parentCountriesOf($GEOGRAPHY_INDEX, geography.uid) : [];
  $: breakdown = isCountry
    ? childSummary($GEOGRAPHY_INDEX, geography.uid).map(({ type: t, count }) => {
        const def = $GEOGRAPHY_TYPES.find((x) => x.uid === t);
        const noun = count === 1 ? (def?.labelSingular ?? def?.label ?? t) : (def?.label ?? t);
        return { type: t, count, label: `${count} ${noun}` };
      })
    : [];
</script>

{#if geography}
  <div class="mt-3 rounded-lg border border-contour-weakest p-3 text-sm">
    <div class="flex items-center gap-2">
      {#if country_icon(geography)}<i class="not-italic font-emoji font-normal" aria-hidden role="presentation">{country_icon(geography)}</i>{/if}
      <span class="font-bold text-theme-base truncate">{geography.label}</span>
      {#if type}<span class="rounded-full bg-surface-weaker px-2 py-0.5 text-xs text-text-weaker">{type.labelSingular ?? type.label}</span>{/if}
    </div>

    {#if isCountry && continent}
      <p class="mt-1 text-xs text-text-weaker">{continent.label}</p>
    {/if}

    {#if !isCountry && parentCountries.length === 1}
      <p class="mt-2 text-xs text-text-weaker">Country: <span class="text-theme-base">{parentCountries[0].label}</span></p>
    {/if}

    {#if !isCountry && parentCountries.length > 1}
      <div class="mt-2">
        <span class="text-xs uppercase tracking-wide text-text-weaker">Also linked to</span>
        <div class="mt-1 flex flex-wrap gap-1">
          {#each parentCountries as c}
            <button type="button" class="rounded-md bg-surface-weaker px-2 py-1 text-xs text-theme-base hover:bg-surface-weak" on:click={() => CURRENT_GEOGRAPHY_UID.set(c.uid)}>{c.label}</button>
          {/each}
        </div>
      </div>
    {/if}

    {#if breakdown.length}
      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {#each breakdown as tag}
          <span class="rounded-full border border-contour-weak px-2 py-0.5 text-theme-base">{tag.label}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<script context="module">
  // Geographies expose either `icon` or `emoji` (flags for countries).
  function country_icon(geo) {
    return geo.icon ?? geo.emoji;
  }
</script>
```

Note: `country_icon` is defined in a `context="module"` block so it is a plain helper, not reactive state. If you prefer, inline `{geography.icon ?? geography.emoji}` in both places instead and drop the module block — functionally identical.

- [ ] **Step 2: Verify it compiles**

Run: `bun run build`
Expected: no errors for `GeoDetailPanel.svelte`. (It isn't rendered yet — wired up in Task 7.)

- [ ] **Step 3: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/GeoDetailPanel.svelte
```

---

## Task 7: Wire up `GeographySelection.svelte` (country-scoped pills + detail panel)

**Files:**
- Modify: `src/lib/components/controls/GeographySelection/GeographySelection.svelte`

**Interfaces:**
- Consumes: `GeoDetailPanel` (Task 6), `$CURRENT_GEOGRAPHY` (existing store).
- Produces: top-level pills exclude `cities`; the content slot renders `<GeoDetailPanel geography={$CURRENT_GEOGRAPHY} />` in place of the old `selectedSummary` tag strip.

- [ ] **Step 1: Add the import and the country-scoped filter**

In the `<script>`, add the import (next to the other component imports):

```js
  import GeoDetailPanel from './GeoDetailPanel.svelte';
```

Add the constant and a filtered pill list near the top of the script (after `export let label`):

```js
  // Cities are only reachable by drilling into a country, so they are excluded
  // from the top-level type pills (matches the inline-accordion interaction).
  const COUNTRY_SCOPED_TYPES = ['cities'];
  $: pillTypes = geographyTypes.filter((t) => !COUNTRY_SCOPED_TYPES.includes(t.uid));
```

- [ ] **Step 2: Point the default-tab logic and the PillGroup at `pillTypes`**

Change the default-tab reactive block to choose from `pillTypes`:

```js
  $: if (!currentFilterUid && pillTypes.length) {
    currentFilterUid = (pillTypes.find((t) => !t.disabled) ?? pillTypes[0]).uid;
  }
```

Change the `PillGroup` options prop in the template:

```svelte
      <PillGroup bind:currentUid={currentFilterUid} options={pillTypes} allowWrap={true} />
```

- [ ] **Step 3: Replace the `selectedSummary` block with the detail panel**

Remove the `selectedSummary` derived block from the script:

```js
  // Map summary tags: only meaningful when a country (admin0) is selected.
  $: selectedSummary =
    $CURRENT_GEOGRAPHY?.geographyType === 'admin0'
      ? childSummary($GEOGRAPHY_INDEX, $CURRENT_GEOGRAPHY.uid).map(({ type, count }) => {
          const t = $GEOGRAPHY_TYPES.find((x) => x.uid === type);
          const noun = count === 1 ? (t?.labelSingular ?? t?.label ?? type) : (t?.label ?? type);
          return { type, count, label: `${count} ${noun}` };
        })
      : [];
```

In the content slot, replace the `{#if selectedSummary.length}` … `{/if}` block with:

```svelte
        <GeoDetailPanel geography={$CURRENT_GEOGRAPHY} />
```

- [ ] **Step 4: Clean up the now-unused `childSummary` import**

`childSummary` is no longer used in this file (moved into `GeoDetailPanel`). Change the import on line ~8 from:

```js
  import { childSummary, geoIdOf } from './geography-tree.js';
```

to:

```js
  import { geoIdOf } from './geography-tree.js';
```

(Keep `geoIdOf` — still used by `Map`.) If `$GEOGRAPHY_TYPES` / `$GEOGRAPHY_INDEX` become unused after this, leave them only if still referenced elsewhere in the file; otherwise remove from the `$stores/meta.js` import to avoid lint noise. (`$GEOGRAPHY_INDEX` is still used by the `Map`'s `geoIdOf` calls, so keep it.)

- [ ] **Step 5: Manual verification**

Run: `bun run dev`, open the modal.
Verify:
1. The top-level pills no longer include **Cities**; `eez`, `river_basins`, etc. remain.
2. Cities are still reachable by expanding a country in the Countries tab.
3. Selecting a **country** shows the detail card: flag/icon + name + "Country" badge + continent + by-type breakdown tags.
4. Selecting a **city** (via accordion) shows the card with its type badge and "Country: <X>".
5. Selecting a **transboundary** river basin / EEZ that our data records with multiple country parents shows "Also linked to" buttons; clicking one re-selects that country. (If no such multi-parent record exists in the data, this section simply doesn't appear — expected.)
6. With nothing selected, the card is absent and the map shows as before.

- [ ] **Step 6: Stage for review**

```bash
git add src/lib/components/controls/GeographySelection/GeographySelection.svelte
```

---

## Task 8: Full regression pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full helper test suite**

Run: `bun test src/lib/components/controls/GeographySelection/geography-tree.test.js`
Expected: PASS (Tasks 1–3 plus the pre-existing `buildIndex`/`geoIdOf`/`childSummary` tests).

- [ ] **Step 2: Run the repo's default test command** (ensure nothing in `api/` regressed)

Run: `bun test api/`
Expected: PASS (unchanged by this work).

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: builds with no errors and no unused-import warnings for the touched files.

- [ ] **Step 4: End-to-end manual walkthrough**

Run: `bun run dev`. In the geography modal confirm the full flow from the spec: countries expand inline (name selects + auto-expands, caret toggles), children selectable inline, no "Back" view, cities absent from pills, and the enriched detail card behaves per Task 7 Step 5.

- [ ] **Step 5: Stage any remaining changes for review** (commit left to the owner)

```bash
git add -A src/lib/components/controls/GeographySelection/
git status
```

---

## Self-Review

**Spec coverage:**
- Inline nested accordion (name-selects / caret-toggles, children grouped by type) → Tasks 3, 4.
- Remove drill-in/replace + "Back to X" → Task 5.
- `cities` country-scoped (removed from pills, still nested) → Tasks 4 (renders children incl. cities) + 7 (pill filter).
- Enriched, data-backed detail panel (identity, type badge, continent, parent-country, cross-links, breakdown) → Tasks 1, 2, 6, 7.
- Helpers unit-tested → Tasks 1–3. Component behavior verified manually (no harness) → Tasks 4, 5, 7, 8.
- Non-goals honored: no API/schema change; no context tags; no map markers; `river_basins`/`eez` stay top-level.

**Placeholder scan:** No TBD/TODO; every code step shows full code; manual-verification steps list concrete checks.

**Type consistency:** `parentCountriesOf(index, uid)` → object[], `continentOf(index, uid)` → object|null, `childGroups(index, countryUid)` → `{type, items}[]` used identically in CountryAccordion (`groups`, `g.items`) and GeoDetailPanel (`parentCountries`, `continent`). `childSummary` signature unchanged. `COUNTRY_SCOPED_TYPES`/`pillTypes` consistent across Task 7 steps.
