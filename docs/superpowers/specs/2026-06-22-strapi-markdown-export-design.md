# Strapi → Markdown export

## Goal

Produce a read-only snapshot of the Strapi editorial content as a folder of
markdown files: one **subdirectory per content type**, and **one `.md` file per
prose "section"**, each carrying YAML frontmatter for its metadata.

This is a snapshot for reading/diffing/archiving — not a re-importable Strapi
transfer dump.

## Source

The hosted Strapi instance read from `.env`:

- Base URL: `VITE_HEROKU_URL` (currently `https://provide-cms.herokuapp.com`)
- Locale: `VITE_STRAPI_LOCALE` (currently `en-EU`)

Fetched the same way the app's `loadFromStrapi()` does:
`${BASE}/api/<type>?populate=*&locale=<locale>&pagination[limit]=9999`.

Content types (from `grep "loadFromStrapi("`):
`about, adaptation, case-study-dynamics, case-study-outro, contact, glossaries,
indicators, issue, scenario-presets, scenarios, stories`.

## Architecture

A pipeline split into a pure transform (tested) and thin I/O shells:

1. **`scripts/strapi-export/fetch.js`** — fetch raw JSON per content type. Thin,
   no logic.
2. **`scripts/strapi-export/to-markdown.js`** — **pure**:
   `entriesToFiles(contentType, json) -> [{ path, frontmatter, body }]`.
   All section-detection rules live here. Unit-tested with fixture JSON (vitest).
3. **`scripts/strapi-export/serialize.js`** — **pure**:
   `({ frontmatter, body }) -> string` renders the YAML `---` block + body.
   Unit-tested.
4. **`scripts/strapi-export/index.js`** — orchestrates fetch → transform →
   serialize → write files, creating subdirectories. Thin.

The transform + serializer hold all the logic and are the focus of tests
(testing trophy: cover the use cases, not the fs/network shells).

## Section-detection rules (the transform)

Walk each entry's `attributes` recursively:

- **String field → its own `.md`** when the key is a known prose key
  (`Text`, `Description`, `Abstract`, `IntroText`, `OutroText`,
  `SelfAssessmentText`, `IntegrationText`, …) **or** the value contains markdown
  / newlines / is longer than ~120 chars.
- **Short scalar-ish strings** (≤120 chars, no markdown/newlines) and known
  metadata keys (`id`, `UID`, `slug`, `Url`, `*Date`, `Type`, `Name`, `locale`,
  `localizations`, `createdAt`, `updatedAt`, `publishedAt`) are **not** sections;
  they are captured as frontmatter (entry/type `_meta.md` or the section's own
  frontmatter) so nothing is lost.
- **`Title`/`Text` pairs** (e.g. `IntroTitle`+`IntroText`): the `*Title` is
  folded into the matching `*Text` file's `title:` frontmatter and H1 — no
  separate file for the title string.
- **Repeatable component arrays** (e.g. `about.Section[]`, `issue.Issues[]`):
  one numbered file per item (`01-…`, `02-…`) to preserve order, named from the
  item's `Title`/`Label` (kebab-cased).
- **Collection types** (many entries, e.g. `scenarios`, `indicators`): one
  subdirectory per entry, keyed by `UID` → `slug` → `id`.

## File format

```markdown
---
contentType: about
title: Contributors
locale: en-EU
order: 2
---

<markdown body>
```

Frontmatter keys: `contentType`, `title`, `locale`, `order` (only for
repeatable-array items).

## Output layout (from real data)

```
strapi-export/
├── about/                 # single type · Section[] {Title, Text}
│   ├── 01-about-the-provide-climate-risk-dashboard.md
│   └── … (8 sections)
├── issue/                 # single type · Issues[] {Title, Description}
│   └── … (4 sections)
├── adaptation/            # single type · flat Title/Text pairs
│   ├── intro.md           # IntroText, titled from IntroTitle
│   ├── self-assessment.md
│   ├── integration.md
│   └── outro.md
└── scenarios/             # collection · 25 entries
    ├── modact/description.md
    └── … (24 more)
```

## Output / invocation

- `node scripts/strapi-export/index.js` (reads `.env` via existing tooling, or
  `BASE=`/`LOCALE=` env overrides). Output dir default `strapi-export/`,
  overridable with `OUT=`.
- Idempotent: rewrites the output directory each run.

## Out of scope (YAGNI)

- Media/binary download (URLs are preserved in frontmatter/body, not the files).
- Re-import (`strapi import`) — use the CLI transfer for that.
- Multi-locale in one run (set `LOCALE=` per run).

## Testing

- `to-markdown.test.js` — fixtures for each shape: single-type section array
  (`about`), `Title/Text` pairs (`adaptation`), collection keyed by UID
  (`scenarios`), and the skip-scalar / fold-title rules. RED first against a stub
  that returns `[]` so failures are on behavior, not missing modules.
- `serialize.test.js` — frontmatter rendering, escaping, body passthrough.
```
